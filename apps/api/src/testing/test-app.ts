import "reflect-metadata";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../app.module.js";
import { type Mail, Mailer } from "../mailer.js";
import { PrismaService } from "../prisma.service.js";

interface Organizer {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}

interface Session {
  id: string;
  organizerId: string;
  expiresAt: Date;
  createdAt: Date;
}

interface PasswordReset {
  id: string;
  organizerId: string;
  expiresAt: Date;
  createdAt: Date;
}

interface Tournament {
  id: string;
  organizerId: string;
  name: string;
  teams: unknown;
  phases: unknown;
  seed: number;
  createdAt: Date;
}

/** A field equals a value, is in a list, or is a date at or before a bound. */
type Condition<V> = V | { in: V[] } | { lte: V };
type Where<T> = { where: { [K in keyof T]?: Condition<T[K]> } };

const holds = (actual: unknown, condition: unknown): boolean => {
  if (typeof condition === "object" && condition !== null && !(condition instanceof Date)) {
    if ("in" in condition) return (condition.in as unknown[]).includes(actual);
    if ("lte" in condition) return (actual as Date) <= (condition.lte as Date);
  }
  return actual === condition;
};

const matches =
  <T extends object>(where: Where<T>["where"]) =>
  (row: T): boolean =>
    Object.entries(where).every(([key, condition]) => holds(row[key as keyof T], condition));

/** Just enough of the Prisma client for the API's routes, kept in memory. */
export function memoryPrisma() {
  const organizers: Organizer[] = [];
  const sessions: Session[] = [];
  const passwordResets: PasswordReset[] = [];
  const deleteWhere = <T extends object>(rows: T[], where: Where<T>["where"]) => {
    const kept = rows.filter((row) => !matches(where)(row));
    const count = rows.length - kept.length;
    rows.splice(0, rows.length, ...kept);
    return { count };
  };
  const tournaments: Tournament[] = [];
  return {
    organizers,
    sessions,
    passwordResets,
    tournaments,
    organizer: {
      create: async ({ data }: { data: Omit<Organizer, "id" | "createdAt"> }) => {
        if (organizers.some((row) => row.email === data.email)) throw { code: "P2002" };
        const row = { ...data, id: `o${organizers.length + 1}`, createdAt: new Date() };
        organizers.push(row);
        return row;
      },
      findUnique: async ({ where }: Where<Organizer>) => organizers.find(matches(where)) ?? null,
      update: async ({ where, data }: Where<Organizer> & { data: Partial<Organizer> }) => {
        const row = organizers.find(matches(where));
        if (row === undefined) throw { code: "P2025" };
        Object.assign(row, data);
        return row;
      },
    },
    passwordReset: {
      create: async ({ data }: { data: Omit<PasswordReset, "createdAt"> }) => {
        const row = { ...data, createdAt: new Date() };
        passwordResets.push(row);
        return row;
      },
      findUnique: async ({ where }: Where<PasswordReset>) =>
        passwordResets.find(matches(where)) ?? null,
      deleteMany: async ({ where }: Where<PasswordReset>) => deleteWhere(passwordResets, where),
    },
    session: {
      create: async ({ data }: { data: Omit<Session, "createdAt"> }) => {
        const row = { ...data, createdAt: new Date() };
        sessions.push(row);
        return row;
      },
      findUnique: async ({ where }: Where<Session>) => sessions.find(matches(where)) ?? null,
      findMany: async ({ where }: Where<Session>) =>
        sessions.filter(matches(where)).map(({ id }) => ({ id })),
      deleteMany: async ({ where }: Where<Session>) => deleteWhere(sessions, where),
    },
    tournament: {
      create: async ({ data }: { data: Omit<Tournament, "id" | "createdAt"> }) => {
        const row = { ...data, id: `t${tournaments.length + 1}`, createdAt: new Date() };
        tournaments.push(row);
        return row;
      },
      findMany: async ({ where }: Where<Tournament>) =>
        tournaments
          .filter(matches(where))
          .map(({ id, name }) => ({ id, name }))
          .reverse(),
      findUnique: async ({ where }: Where<Tournament>) => tournaments.find(matches(where)) ?? null,
    },
    $disconnect: async () => {},
  };
}

export interface TestApp {
  readonly app: INestApplication;
  readonly url: string;
  readonly db: ReturnType<typeof memoryPrisma>;
  /** Emails the API sent, newest last. */
  readonly mails: Mail[];
}

/** Starts the whole API on a free port, with the in-memory database. */
export async function startTestApp(): Promise<TestApp> {
  const db = memoryPrisma();
  const mails: Mail[] = [];
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(db)
    .overrideProvider(Mailer)
    .useValue({ send: async (mail: Mail) => void mails.push(mail) })
    .compile();
  const app = moduleRef.createNestApplication();
  await app.listen(0);
  return {
    app,
    db,
    mails,
    url: `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`,
  };
}

/** Sends JSON, with a session cookie when one is given. */
export const send = (
  url: string,
  method: string,
  body?: unknown,
  cookie?: string,
): Promise<Response> =>
  fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: body === undefined ? null : JSON.stringify(body),
  });

/** The `name=value` part of a response's session cookie, ready to send back. */
export const cookieOf = (response: Response): string =>
  (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

let accounts = 0;

/** Creates an organizer account and returns its session cookie. */
export async function signUp(url: string, email = `organizer${++accounts}@club.fr`) {
  const response = await send(`${url}/auth/signup`, "POST", {
    email,
    name: "Organizer",
    password: "correct horse battery",
  });
  if (response.status !== 201) throw new Error(`sign-up failed: ${response.status}`);
  return cookieOf(response);
}
