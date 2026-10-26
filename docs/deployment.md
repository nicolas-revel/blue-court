# Deployment

The whole app runs with Docker Compose: PostgreSQL, the API (`apps/api`) and the web app (`apps/web`).

## Local

```sh
cp .env.example .env   # then choose a database password in .env
docker compose up --build
```

The web app is on http://localhost:3000 and the API on http://localhost:4000. The API applies pending database migrations when it starts.

To work on the code without the images, start only the database (`docker compose up db`), then run `pnpm --filter @blue-court/api start` with `DATABASE_URL` set to `postgres://blue-court:<password>@localhost:5432/blue-court`, and `pnpm --filter @blue-court/web dev`.

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

In `.env` on the server, set a strong `POSTGRES_PASSWORD` (Compose refuses to start without `.env`, and Postgres without a password), set `WEB_ORIGIN` to the public address, and change the `*_PORT` values if another service already uses them.

The API has no authentication yet: anyone who reaches it can create tournaments. Keep it off the public internet until accounts land (#22).
