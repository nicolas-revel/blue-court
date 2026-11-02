# Organizer accounts

Organizers create an account with an email and a password, then find their own tournaments. Players, spectators and the venue display never need an account.

## Behavior

- **Who signs in**: organizers only. Score entry from a phone uses a court or match code (see [scoring.md](scoring.md)), not an account; it comes with score entry.
- **Sign-up** is open to anyone: name, email and password. The account is signed in right away.
- **Sign-in** with email and password. A wrong email and a wrong password get the same message. Sign-up still says when an email is already used, so it can tell whether an email has an account: with open sign-up and no email check, this is accepted, and the rate limit slows down anyone trying many emails.
- **Ownership**: a tournament belongs to the organizer who created it. Other organizers cannot list it or open it: for them it does not exist.
- **Sign-out** ends the session on that device, including its live updates.
- **What stays public**: the home page, sign-up and sign-in. Everything else is closed by default, live updates included. The public view and the venue display will open their own read-only pages and routes when they are built.
- **Offline**: the organizer area is never kept for offline use, so a shared phone does not show it to the next person, even after sign-out. Public pages keep working offline as before.

## Settings (defaults)

| Setting | Default |
| --- | --- |
| Password length | 10 to 200 characters |
| Session length | 30 days, then sign in again |
| Sign-up and sign-in attempts | 10 per minute each, from one address |

These are platform settings, not tournament settings: they are the same for every organizer.

## Edge cases

- The email is compared without regard to case or surrounding spaces: `Coach@Club.fr` and `coach@club.fr` are the same account, and a second sign-up with it is refused.
- An expired or deleted session is treated as signed out. Live updates opened with it stop within five minutes, and expired sessions are purged at the same pace.
- An 11th attempt within a minute is refused with a "try again in a minute" message.

## Examples

- Camille signs up as `camille@club.fr` and creates the "Christmas tournament". Dominique signs up too: their list of tournaments is empty, and the Christmas tournament's link answers "not found".
- Camille signs out on the gym's shared tablet: the next person who opens the organizer area on it gets the sign-in page, online or offline.

## Out of scope

- Forgotten password by email (for now, an administrator resets it in the database).
- Several organizers on one tournament (open question in [out-of-scope.md](out-of-scope.md)).
- Sign-in with an external provider or a magic link.
