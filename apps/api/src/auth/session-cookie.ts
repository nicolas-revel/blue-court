import { secureCookies } from "../config.js";

export const SESSION_COOKIE = "blue_court_session";

/** How long a sign-in lasts before the organizer must sign in again. */
export const SESSION_DAYS = 30;

/** Reads the session token from a `Cookie` header, if there is one. */
export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  for (const part of cookieHeader?.split(";") ?? []) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=") || undefined;
  }
  return undefined;
}

/**
 * The cookie is out of reach of page scripts, and `SameSite=Lax` keeps other sites from sending
 * it with their requests. The web app and the API share a site, locally (ports do not count) and
 * on the server (same host, the API under `/api`).
 */
export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    ...(secureCookies ? ["Secure"] : []),
  ].join("; ");
}
