# API

The web app and the venue screens talk to one HTTP API, plus a WebSocket for live updates. This file covers what is built so far; routes are added with the features that need them.

## Accounts

See [accounts.md](accounts.md). The session lives in an `HttpOnly`, `SameSite=Lax` cookie set by the API (`Secure` once the web app is served over HTTPS).

- **Sign up** (`POST /auth/signup`): name, email and password. Creates the account, signs it in and returns it (id, email, name). An invalid field answers 400 with every problem found; an email already used answers 409.
- **Sign in** (`POST /auth/login`): email and password. Answers 200 with the organizer, or 401 with the same message whether the email or the password is wrong.
- **Sign out** (`POST /auth/logout`): ends the session and disconnects its live updates. Answers 204.
- **Who am I** (`GET /auth/me`): the signed-in organizer.
- **Forgotten password** (`POST /auth/password-reset`): an email. Answers 202 whether or not it has an account, and emails a reset link when it does (400 only when it is not an email address).
- **New password** (`POST /auth/password-reset/confirm`): the token from the link and a new password. Ends every session of the account and its live updates, then signs in and answers 200 with the organizer. An unknown, used or expired token answers 400.
- Sign-up, sign-in and the two password reset routes each answer 429 after 10 attempts in a minute from one address.

## Tournaments

Every tournament route needs a session, and only sees the signed-in organizer's tournaments.

- **Create** (`POST /tournaments`): the body gives the tournament's name, teams and phases, in the engine's shapes. The settings are checked first (see [match-rules.md](match-rules.md#configuration-validation)):
  - a body that is not an object is refused;
  - every other problem is refused with every error found, each with its code, message and path: a missing or mistyped setting (`MALFORMED`), or a setting that can never work;
  - a valid tournament is stored with a draw seed drawn at random by the API (a whole number from 0 to 2^31 - 1). Every draw of the tournament derives from that seed, so it is returned with the tournament and the same tournament always gives the same pools.
- **List** (`GET /tournaments`): the organizer's tournaments, id and name, newest first.
- **Read** (`GET /tournaments/:id`): the whole tournament with its seed. An unknown id, or another organizer's tournament, is answered as not found.
- Refused requests answer 400; anything else that fails is a server error. Since the engine reports malformed settings instead of throwing, a server error while checking a tournament is always an engine bug.

## Live updates

The socket accepts a connection only with a valid session cookie, and from a browser only when it comes from the web app's address. An organizer's screens receive a `tournament.created` event, with the id and name, whenever that organizer creates a tournament.

## Access

Only the health check (`GET /health`), sign-up, sign-in and the two password reset routes are open without a session; a test pins that list. Only the web app's address may call the API from a browser.

## Web app offline

The web app can be installed. When the connection drops, it shows the last version of each public page that loaded successfully. The organizer area (`/organizer`) is never cached.
