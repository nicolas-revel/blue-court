import { cookies } from "next/headers";

export interface Organizer {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface TournamentSummary {
  readonly id: string;
  readonly name: string;
}

/** Where the web server reaches the API (inside Docker Compose, `http://api:4000`). */
const serverApiUrl = (): string => process.env.API_URL ?? "http://localhost:4000";

/**
 * Where browsers reach the API: read at request time, so one image serves every address. On the
 * server it is the public address followed by `/api` (see docs/deployment.md).
 */
export const publicApiUrl = (): string => process.env.PUBLIC_API_URL ?? "http://localhost:4000";

/** Calls the API from the web server, on behalf of the visitor and with their session cookie. */
async function fromServer(path: string): Promise<Response> {
  return fetch(`${serverApiUrl()}${path}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });
}

/** The signed-in organizer, or `null` for a visitor. */
export async function currentOrganizer(): Promise<Organizer | null> {
  const response = await fromServer("/auth/me");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`API answered ${response.status} to /auth/me`);
  return response.json();
}

export async function myTournaments(): Promise<TournamentSummary[]> {
  const response = await fromServer("/tournaments");
  if (!response.ok) throw new Error(`API answered ${response.status} to /tournaments`);
  return response.json();
}
