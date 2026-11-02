import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./limits.js";
import { decoyHash, hashPassword, verifyPassword } from "./password.js";
import { SESSION_DAYS } from "./session-cookie.js";

export interface Organizer {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

/** A signed-in organizer and the session they used. */
export interface SignedIn {
  readonly organizer: Organizer;
  readonly sessionId: string;
}

/** A new session: the token goes into the cookie, only its hash into the database. */
export interface NewSession extends SignedIn {
  readonly token: string;
  readonly maxAgeSeconds: number;
}

const EMAIL_MAX_LENGTH = 254;
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

/** Lowercase and trimmed, or `undefined` when it is not an email address. */
export const normalizeEmail = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const email = value.trim().toLowerCase();
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_FORMAT.test(email) ? email : undefined;
};

const toOrganizer = ({ id, email, name }: Organizer): Organizer => ({ id, email, name });

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates an organizer account and signs it in. */
  async signUp(body: unknown): Promise<NewSession> {
    const { email, name, password } = asRecord(body);
    const errors: string[] = [];
    const validEmail = normalizeEmail(email);
    if (validEmail === undefined) errors.push("email: not a valid email address");
    const validName = typeof name === "string" ? name.trim() : "";
    if (validName.length === 0 || validName.length > NAME_MAX_LENGTH) {
      errors.push(`name: between 1 and ${NAME_MAX_LENGTH} characters`);
    }
    if (
      typeof password !== "string" ||
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      errors.push(`password: between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`);
    }
    if (validEmail === undefined || typeof password !== "string" || errors.length > 0) {
      throw new BadRequestException({ message: "invalid account", errors });
    }
    try {
      const organizer = await this.prisma.organizer.create({
        data: { email: validEmail, name: validName, passwordHash: await hashPassword(password) },
      });
      return this.openSession(toOrganizer(organizer));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ message: "an account already uses this email" });
      }
      throw error;
    }
  }

  /** Signs an organizer in. A wrong email and a wrong password get the same answer. */
  async signIn(body: unknown): Promise<NewSession> {
    const { email, password } = asRecord(body);
    const validEmail = normalizeEmail(email);
    const organizer =
      validEmail === undefined
        ? null
        : await this.prisma.organizer.findUnique({ where: { email: validEmail } });
    const valid =
      typeof password === "string" &&
      password.length <= PASSWORD_MAX_LENGTH &&
      (await verifyPassword(password, organizer?.passwordHash ?? (await decoyHash)));
    if (organizer === null || !valid) {
      throw new UnauthorizedException({ message: "wrong email or password" });
    }
    return this.openSession(toOrganizer(organizer));
  }

  async signOut(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  /**
   * Deletes expired sessions and returns, among the given ones, those that no longer exist, so
   * that their live updates can be stopped.
   */
  async sweep(sessionIds: readonly string[], now = new Date()): Promise<string[]> {
    await this.prisma.session.deleteMany({ where: { expiresAt: { lte: now } } });
    const alive = await this.prisma.session.findMany({
      where: { id: { in: [...sessionIds] } },
      select: { id: true },
    });
    const aliveIds = new Set(alive.map((session) => session.id));
    return sessionIds.filter((id) => !aliveIds.has(id));
  }

  /** The organizer behind a session token, if the session exists and has not expired. */
  async check(token: string | undefined, now = new Date()): Promise<SignedIn | undefined> {
    if (token === undefined) return undefined;
    const sessionId = hashToken(token);
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (session === null) return undefined;
    if (session.expiresAt <= now) {
      await this.signOut(sessionId);
      return undefined;
    }
    const organizer = await this.prisma.organizer.findUnique({
      where: { id: session.organizerId },
    });
    return organizer === null ? undefined : { organizer: toOrganizer(organizer), sessionId };
  }

  private async openSession(organizer: Organizer): Promise<NewSession> {
    const token = randomBytes(32).toString("base64url");
    const maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60;
    const sessionId = hashToken(token);
    await this.prisma.session.create({
      data: {
        id: sessionId,
        organizerId: organizer.id,
        expiresAt: new Date(Date.now() + maxAgeSeconds * 1000),
      },
    });
    return { organizer, sessionId, token, maxAgeSeconds };
  }
}
