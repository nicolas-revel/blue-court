import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { webOrigin } from "../config.js";
import { Mailer } from "../mail/mailer.js";
import { resetMail } from "../mail/messages.fr.js";
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

/** How long a password reset link works. */
export const RESET_LINK_MINUTES = 60;
/** How long before another reset email can be sent for the same account. */
export const RESET_RESEND_SECONDS = 60;

const newToken = (): string => randomBytes(32).toString("base64url");

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

const isValidPassword = (password: unknown): password is string =>
  typeof password === "string" &&
  password.length >= PASSWORD_MIN_LENGTH &&
  password.length <= PASSWORD_MAX_LENGTH;

const PASSWORD_RULE = `password: between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`;

const logger = new Logger("AuthService");

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
  ) {}

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
    if (!isValidPassword(password)) errors.push(PASSWORD_RULE);
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
      (await verifyPassword(password, organizer?.passwordHash ?? (await decoyHash())));
    if (organizer === null || !valid) {
      throw new UnauthorizedException({ message: "wrong email or password" });
    }
    return this.openSession(toOrganizer(organizer));
  }

  /**
   * Emails a reset link when the email has an account. The answer is the same either way, and
   * the email is sent in the background, so neither the answer nor its timing tells whether the
   * account exists.
   */
  requestPasswordReset(body: unknown): void {
    const email = normalizeEmail(asRecord(body).email);
    if (email === undefined) {
      throw new BadRequestException({ message: "invalid email", errors: ["email: not valid"] });
    }
    void this.sendResetLink(email).catch((error: unknown) =>
      logger.error(`password reset email failed: ${String(error)}`),
    );
  }

  private async sendResetLink(email: string): Promise<void> {
    const organizer = await this.prisma.organizer.findUnique({ where: { email } });
    if (organizer === null) return;
    const token = newToken();
    if (!(await this.replaceResetLink(organizer.id, hashToken(token)))) return;
    // The token sits after `#`, which browsers never send to a server or in a Referer header.
    const link = `${webOrigin}/organizer/reset-password#${token}`;
    await this.mailer.send({
      to: organizer.email,
      ...resetMail({ name: organizer.name, link, minutes: RESET_LINK_MINUTES }),
    });
  }

  /**
   * Stores a new link for the organizer, replacing the previous one, unless that one is less
   * than a minute old. Each path is a single write, so of two requests racing, only one stores a
   * link and sends an email. The one-a-minute limit bounds the emails and how often someone else
   * can replace the pending link (the trade-off is in docs/specs/accounts.md).
   */
  private async replaceResetLink(organizerId: string, tokenHash: string): Promise<boolean> {
    const now = Date.now();
    const link = {
      tokenHash,
      expiresAt: new Date(now + RESET_LINK_MINUTES * 60 * 1000),
      createdAt: new Date(now),
    };
    const { count } = await this.prisma.passwordReset.updateMany({
      where: { organizerId, createdAt: { lte: new Date(now - RESET_RESEND_SECONDS * 1000) } },
      data: link,
    });
    if (count === 1) return true;
    try {
      await this.prisma.passwordReset.create({ data: { organizerId, ...link } });
      return true;
    } catch (error) {
      // A link less than a minute old already exists, or another request just stored one.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  /**
   * Sets a new password from a reset link. Every session of the account ends, and a new one
   * opens on this device.
   */
  async resetPassword(body: unknown, now = new Date()): Promise<NewSession> {
    const { token, password } = asRecord(body);
    if (!isValidPassword(password)) {
      throw new BadRequestException({ message: "invalid password", errors: [PASSWORD_RULE] });
    }
    const invalid = new BadRequestException({
      message: "this reset link is invalid or has expired",
    });
    if (typeof token !== "string") throw invalid;
    const tokenHash = hashToken(token);
    const reset = await this.prisma.passwordReset.findUnique({ where: { tokenHash } });
    if (reset === null) throw invalid;
    // Hashed first, so the slow part stays outside the transaction.
    const passwordHash = await hashPassword(password);
    // All or nothing: a failure leaves the link usable and the old password and sessions as
    // they were.
    const organizer = await this.prisma.$transaction(async (tx) => {
      // Used once: the delete is the gate. Of two requests racing with the same link, only the
      // one whose delete removed the row goes on.
      const { count } = await tx.passwordReset.deleteMany({
        where: { tokenHash, expiresAt: { gt: now } },
      });
      if (count === 0) throw invalid;
      const updated = await tx.organizer.update({
        where: { id: reset.organizerId },
        data: { passwordHash },
      });
      await tx.session.deleteMany({ where: { organizerId: updated.id } });
      return updated;
    });
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
    await this.prisma.passwordReset.deleteMany({ where: { expiresAt: { lte: now } } });
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
    const token = newToken();
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
