# API

The web app and the venue screens talk to one HTTP API, plus a WebSocket for live updates. This file covers what is built so far; routes are added with the features that need them.

## Tournaments

- **Create** (`POST /tournaments`): the body gives the tournament's name, teams and phases, in the engine's shapes. The settings are checked first (see [match-rules.md](match-rules.md#configuration-validation)):
  - every team and phase must be an object with an id, otherwise the request is refused as malformed;
  - settings that can never work are refused with every error found, each with its code, message and path;
  - a valid tournament is stored with a draw seed drawn at random by the API (a whole number from 0 to 2^31 - 1). Every draw of the tournament derives from that seed, so it is returned with the tournament and the same tournament always gives the same pools.
- **List** (`GET /tournaments`): every tournament's id and name, newest first.
- **Read** (`GET /tournaments/:id`): the whole tournament with its seed. An unknown id is answered as not found.
- Refused requests answer 400; anything else that fails is a server error.

## Live updates

Connected screens receive a `tournament.created` event, with the id and name, whenever a tournament is created.

## Access

There are no accounts yet: anyone who reaches the API can use it, so it stays off the public internet until organizer accounts land (#22). Only the web app's address may call it from a browser.

## Web app offline

The web app can be installed. When the connection drops, it shows the last version of each page that loaded successfully.
