import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { io } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";
import { cookieOf, send, signUp, startTestApp, type TestApp } from "../testing/test-app.js";
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
});

describe("public routes", () => {
  it("are only the health check, sign-up and sign-in", () => {
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
        return [`${method} /${[base, path].filter((part) => part !== "/").join("/")}`];
      });
    });
    expect(publicRoutes.sort()).toEqual(["GET /health", "POST /auth/login", "POST /auth/signup"]);
  });
});
