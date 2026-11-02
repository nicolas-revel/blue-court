# Deployment

The whole app runs with Docker Compose: PostgreSQL, the API (`apps/api`) and the web app (`apps/web`).

## Local

```sh
cp .env.example .env   # then choose a database password in .env
docker compose up --build
```

The web app is on http://localhost:3000 and the API on http://localhost:4000. The API applies pending database migrations when it starts.

To work on the code without the images, start only the database (`docker compose up db`), then run `pnpm --filter @blue-court/api start` with `DATABASE_URL` set to `postgres://blue-court:<password>@localhost:5432/blue-court`, and `pnpm --filter @blue-court/web dev` (the web app finds the API on http://localhost:4000 by default; `API_URL` and `PUBLIC_API_URL` change it). Create an organizer account at http://localhost:3000/organizer/signup.

## Server

The VPS already serves HTTPS with Caddy, so the stack sits behind it rather than behind its own proxy. Compose binds every port to `127.0.0.1` only, and Caddy forwards to them:

```caddyfile
tournois.example.fr {
	handle /api/* {
		uri strip_prefix /api
		reverse_proxy 127.0.0.1:4000
	}
	handle /socket.io/* {
		reverse_proxy 127.0.0.1:4000
	}
	handle {
		reverse_proxy 127.0.0.1:3000
	}
}
```

In `.env` on the server, set a strong `POSTGRES_PASSWORD` made of letters and digits only, as it goes into the database URL (`openssl rand -hex 24`) (Compose refuses to start without `.env`, and Postgres without a password), set `WEB_ORIGIN` to the public address (`https://tournois.example.fr`, which also makes the session cookie HTTPS-only), set `PUBLIC_API_URL` to that address followed by `/api` (`https://tournois.example.fr/api`), set `TRUST_PROXY_HOPS=1` so sign-in rate limits see each visitor's address through Caddy (leave it at 0 when nothing sits in front of the API, or clients could forge their address), and change the `*_PORT` values if another service already uses them.

Password reset links are sent by email through any SMTP server: set `SMTP_URL` (for example `smtps://<user>:<password>@smtp.tem.scaleway.com:465` for Scaleway Transactional Email) and `MAIL_FROM` (for example `Blue Court <no-reply@tournois.example.fr>`, a sender the SMTP provider has verified). `SMTP_URL` is required in production. Without it, no email is sent. Locally, set `MAIL_LOG_BODY=1` (the value in `.env.example`): the API then writes each email to its log, which is how to get a reset link in development. On the server, set `MAIL_LOG_BODY=0`: the log then only names the recipient and subject, so a reset link never goes to it.

Every API route except the health check, sign-up, sign-in and password reset needs an organizer session, and so does the socket (see [specs/accounts.md](specs/accounts.md)). Sign-up is open: anyone who reaches the site can create an organizer account.
