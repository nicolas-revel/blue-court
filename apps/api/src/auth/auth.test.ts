import { RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { ThrottlerGuard } from "@nestjs/throttler";
import { io } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../app.module.js";
import { LiveGateway } from "../live.gateway.js";
import { cookieOf, send, signUp, startTestApp, type TestApp } from "../testing/test-app.js";
import { AuthService } from "./auth.service.js";
import { IS_PUBLIC } from "./public.decorator.js";

const password = "correct horse battery";

describe("organizer accounts", () => {
  let test: TestApp;
  let url: string;

  beforeEach(async () => {
    test = await startTestApp();
    url = test.url;
  });

  afterEach(async () => {
    await test.app.close();
  });

  const post = (path: string, body?: unknown, cookie?: string) =>
    send(`${url}${path}`, "POST", body, cookie);
  const me = (cookie?: string) => send(`${url}/auth/me`, "GET", undefined, cookie);

  it("signs up, then knows who is signed in", async () => {
    const response = await post("/auth/signup", {
      email: "  Coach@Club.FR ",
      name: " Camille ",
      password,
    });
    expect(response.status).toBe(201);
    const organizer = await response.json();
    expect(organizer).toEqual({ id: expect.any(String), email: "coach@club.fr", name: "Camille" });

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^blue_court_session=[\w-]{43}; /);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(await (await me(cookieOf(response))).json()).toEqual(organizer);
  });

  it("stores neither the password nor the session token", async () => {
    const response = await post("/auth/signup", { email: "a@club.fr", name: "A", password });
    const [organizer] = test.db.organizers;
    expect(organizer?.passwordHash).toMatch(/^scrypt\$/);
    expect(organizer?.passwordHash).not.toContain(password);
    const token = cookieOf(response).split("=")[1] ?? "";
    expect(test.db.sessions.map((session) => session.id)).not.toContain(token);
  });

  it("refuses an invalid account with every problem found", async () => {
    const response = await post("/auth/signup", { email: "nope", name: "", password: "short" });
    expect(response.status).toBe(400);
    const { errors } = await response.json();
    expect(errors).toHaveLength(3);
    expect((await post("/auth/signup", null)).status).toBe(400);
    expect(test.db.organizers).toEqual([]);
  });

  it("refuses a second account with the same email, whatever the case", async () => {
    await signUp(url, "coach@club.fr");
    const again = await post("/auth/signup", { email: "COACH@club.fr", name: "B", password });
    expect(again.status).toBe(409);
  });

  it("signs in with the right password only, with the same answer for an unknown email", async () => {
    await signUp(url, "coach@club.fr");
    const wrong = await post("/auth/login", { email: "coach@club.fr", password: "not the one" });
    const unknown = await post("/auth/login", { email: "who@club.fr", password });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const right = await post("/auth/login", { email: "Coach@club.fr", password });
    expect(right.status).toBe(200);
    expect((await me(cookieOf(right))).status).toBe(200);
  });

  it("signs out: the session no longer works and the cookie is cleared", async () => {
    const cookie = await signUp(url);
    const response = await post("/auth/logout", undefined, cookie);
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await me(cookie)).status).toBe(401);
    expect(test.db.sessions).toEqual([]);
  });

  it("refuses a missing, forged or expired session", async () => {
    expect((await me()).status).toBe(401);
    expect((await me("blue_court_session=forged")).status).toBe(401);
    const cookie = await signUp(url);
    for (const session of test.db.sessions) session.expiresAt = new Date(Date.now() - 1000);
    expect((await me(cookie)).status).toBe(401);
    expect(test.db.sessions).toEqual([]);
  });

  it("limits sign-in attempts from one address", async () => {
    const attempts = Array.from({ length: 11 }, () =>
      post("/auth/login", { email: "who@club.fr", password }),
    );
    const statuses = (await Promise.all(attempts)).map((response) => response.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(10);
    expect(statuses).toContain(429);
  });

  it("limits sign-up attempts from one address", async () => {
    // Invalid accounts still count, and skip the slow password hashing.
    const attempts = Array.from({ length: 11 }, () => post("/auth/signup", { email: "nope" }));
    const statuses = (await Promise.all(attempts)).map((response) => response.status);
    expect(statuses.filter((status) => status === 400)).toHaveLength(10);
    expect(statuses).toContain(429);
  });

  it("refuses live updates without a session, and ends them on sign-out", async () => {
    const refused = io(url, { transports: ["websocket"], reconnection: false });
    const error = await new Promise<Error>((resolve) => refused.on("connect_error", resolve));
    expect(error.message).toBe("sign in first");
    refused.close();

    const cookie = await signUp(url);
    const socket = io(url, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { cookie },
    });
    await new Promise<void>((resolve) => socket.on("connect", resolve));
    const disconnected = new Promise<string>((resolve) => socket.on("disconnect", resolve));
    await post("/auth/logout", undefined, cookie);
    expect(await disconnected).toBe("io server disconnect");
  });

  it("refuses live updates opened from another site, even with a session", async () => {
    const cookie = await signUp(url);
    const socket = io(url, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { cookie, origin: "https://elsewhere.example" },
    });
    const error = await new Promise<Error>((resolve) => socket.on("connect_error", resolve));
    expect(error.message).toBe("forbidden origin");
    socket.close();
  });

  it("purges expired sessions and disconnects their live updates", async () => {
    const cookie = await signUp(url);
    const socket = io(url, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { cookie },
    });
    await new Promise<void>((resolve) => socket.on("connect", resolve));
    const disconnected = new Promise<string>((resolve) => socket.on("disconnect", resolve));
    const kept = await signUp(url);

    const later = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    for (const session of test.db.sessions.slice(0, 1)) session.expiresAt = new Date(0);
    await test.app.get(LiveGateway).sweep();
    expect(await disconnected).toBe("io server disconnect");
    expect(test.db.sessions).toHaveLength(1);
    expect((await me(kept)).status).toBe(200);

    await test.app.get(LiveGateway).sweep(later);
    expect(test.db.sessions).toEqual([]);
  });
});

describe("forgotten password", () => {
  let test: TestApp;
  let url: string;

  beforeEach(async () => {
    test = await startTestApp();
    url = test.url;
  });

  afterEach(async () => {
    await test.app.close();
  });

  const post = (path: string, body?: unknown, cookie?: string) =>
    send(`${url}${path}`, "POST", body, cookie);
  const me = (cookie: string) => send(`${url}/auth/me`, "GET", undefined, cookie);
  /** Waits for the reset email sent in the background, and returns the token from its link. */
  const tokenFromMail = async (): Promise<string> => {
    await vi.waitFor(() => expect(test.mails).not.toHaveLength(0));
    const link = /https?:\/\/\S+/.exec(test.mails.at(-1)?.text ?? "")?.[0] ?? "";
    expect(link).toMatch(/^http:\/\/localhost:3000\/organizer\/reset-password#[\w-]{43}$/);
    return link.split("#")[1] ?? "";
  };
  const newPassword = "a brand new password";
  /** Makes pending links older than the one-email-a-minute limit. */
  const ageResetLinks = () => {
    for (const reset of test.db.passwordResets) reset.createdAt = new Date(Date.now() - 61_000);
  };

  it("sends at most one email a minute per account, and keeps the pending link", async () => {
    await signUp(url, "coach@club.fr");
    await post("/auth/password-reset", { email: "coach@club.fr" });
    const token = await tokenFromMail();
    for (let i = 0; i < 3; i++) {
      expect((await post("/auth/password-reset", { email: "coach@club.fr" })).status).toBe(202);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(test.mails).toHaveLength(1);
    const confirmed = await post("/auth/password-reset/confirm", { token, password: newPassword });
    expect(confirmed.status).toBe(200);
  });

  it("drops a link whose email could not be sent, so the organizer can ask again at once", async () => {
    await signUp(url, "coach@club.fr");
    vi.spyOn(test.mails, "push").mockImplementationOnce(() => {
      throw new Error("SMTP down");
    });
    expect((await post("/auth/password-reset", { email: "coach@club.fr" })).status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(test.db.passwordResets).toHaveLength(0);
    await post("/auth/password-reset", { email: "coach@club.fr" });
    const token = await tokenFromMail();
    const confirmed = await post("/auth/password-reset/confirm", { token, password: newPassword });
    expect(confirmed.status).toBe(200);
  });

  it("emails a link that sets a new password, ends other sessions and signs in", async () => {
    const oldSession = await signUp(url, "coach@club.fr");
    const asked = await post("/auth/password-reset", { email: "Coach@Club.fr" });
    expect(asked.status).toBe(202);
    const token = await tokenFromMail();
    expect(test.mails[0]?.to).toBe("coach@club.fr");
    expect(test.db.passwordResets.map((reset) => reset.tokenHash)).not.toContain(token);

    const reset = await post("/auth/password-reset/confirm", { token, password: newPassword });
    expect(reset.status).toBe(200);
    expect((await me(cookieOf(reset))).status).toBe(200);
    expect((await me(oldSession)).status).toBe(401);

    const signIn = (password: string) => post("/auth/login", { email: "coach@club.fr", password });
    expect((await signIn(password)).status).toBe(401);
    expect((await signIn(newPassword)).status).toBe(200);
  });

  it("answers the same for an unknown email, and sends nothing", async () => {
    const asked = await post("/auth/password-reset", { email: "who@club.fr" });
    expect(asked.status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(test.mails).toEqual([]);
    expect((await post("/auth/password-reset", { email: "nope" })).status).toBe(400);
  });

  it("works once, with the latest link only, and not after an hour", async () => {
    await signUp(url, "coach@club.fr");
    await post("/auth/password-reset", { email: "coach@club.fr" });
    const first = await tokenFromMail();
    ageResetLinks();
    await post("/auth/password-reset", { email: "coach@club.fr" });
    await vi.waitFor(() => expect(test.mails).toHaveLength(2));
    const second = await tokenFromMail();

    const confirm = (token: string) =>
      post("/auth/password-reset/confirm", { token, password: newPassword });
    expect((await confirm(first)).status).toBe(400);
    expect((await confirm(second)).status).toBe(200);
    expect((await confirm(second)).status).toBe(400);

    ageResetLinks();
    await post("/auth/password-reset", { email: "coach@club.fr" });
    await vi.waitFor(() => expect(test.mails).toHaveLength(3));
    const late = await tokenFromMail();
    for (const reset of test.db.passwordResets) reset.expiresAt = new Date(Date.now() - 1000);
    expect((await confirm(late)).status).toBe(400);
  });

  it("stores one link and sends one email when two requests race", async () => {
    await signUp(url, "coach@club.fr");
    const auth = test.app.get(AuthService);
    auth.requestPasswordReset({ email: "coach@club.fr" });
    auth.requestPasswordReset({ email: "coach@club.fr" });
    await vi.waitFor(() => expect(test.mails).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(test.mails).toHaveLength(1);
    expect(test.db.passwordResets).toHaveLength(1);
  });

  it("lets only one of two simultaneous uses of a link through", async () => {
    await signUp(url, "coach@club.fr");
    await post("/auth/password-reset", { email: "coach@club.fr" });
    const token = await tokenFromMail();
    // Called on the service directly, so both lookups run before either delete.
    const auth = test.app.get(AuthService);
    const answers = await Promise.allSettled(
      ["first password!", "second password!"].map((password) =>
        auth.resetPassword({ token, password }),
      ),
    );
    expect(answers.map((answer) => answer.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(test.db.sessions).toHaveLength(1);
  });

  it("refuses a new password that breaks the rules, and keeps the link", async () => {
    await signUp(url, "coach@club.fr");
    await post("/auth/password-reset", { email: "coach@club.fr" });
    const token = await tokenFromMail();
    const short = await post("/auth/password-reset/confirm", { token, password: "short" });
    expect(short.status).toBe(400);
    expect(test.db.passwordResets).toHaveLength(1);
  });
});

describe("public routes", () => {
  it("are only the health check, sign-up, sign-in and password reset, all rate limited", () => {
    const controllers: (new (...args: never[]) => object)[] = Reflect.getMetadata(
      "controllers",
      AppModule,
    );
    const publicRoutes = controllers.flatMap((controller) => {
      const base: string = Reflect.getMetadata(PATH_METADATA, controller);
      const classIsPublic = Reflect.getMetadata(IS_PUBLIC, controller) === true;
      return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (typeof handler !== "function") return [];
        const path: string | undefined = Reflect.getMetadata(PATH_METADATA, handler);
        if (path === undefined) return [];
        if (!classIsPublic && Reflect.getMetadata(IS_PUBLIC, handler) !== true) return [];
        const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
        const route = `${method} /${[base, path].filter((part) => part !== "/").join("/")}`;
        const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
        // Every public route but the health check is rate limited.
        if (route !== "GET /health") expect(guards, route).toContain(ThrottlerGuard);
        return [route];
      });
    });
    expect(publicRoutes.sort()).toEqual([
      "GET /health",
      "POST /auth/login",
      "POST /auth/password-reset",
      "POST /auth/password-reset/confirm",
      "POST /auth/signup",
    ]);
  });
});
