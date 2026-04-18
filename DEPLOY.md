# EMS v1.0 — Deployment

## Voraussetzungen

- Docker und Docker Compose (für den mitgelieferten Stack), oder Node 20 LTS für manuellen Betrieb
- Öffentliche URL mit HTTPS (Reverse-Proxy empfohlen)

## Konfiguration

1. Kopiere `.env.example` nach `.env`.
2. Setze mindestens:
   - `DATABASE_URL` — lokal z. B. `file:./dev.db`; mit dem mitgelieferten Compose wird die DB-URL in `docker-compose.yml` auf `file:./data/ems.db` gesetzt (persistentes Volume).
   - `JWT_SECRET` — lange zufällige Zeichenkette
   - `APP_URL` — z. B. `https://deine-domain.de` (ohne Slash am Ende)
3. Optional: Google Calendar (`GOOGLE_*`), SMTP (`SMTP_*`) wie in `.env.example`.

Google OAuth: Redirect-URI `{APP_URL}/api/google-calendar/callback` in der Google Cloud Console eintragen.

## Mit Docker Compose

```bash
docker compose up -d --build
```

Die App lauscht auf Port **3000**. Davor einen Reverse-Proxy (Caddy, Nginx, Traefik) mit TLS und Weiterleitung auf `127.0.0.1:3000` setzen.

## Ohne Docker

```bash
npm ci
cp .env.example .env   # anpassen
npx prisma migrate deploy
npm run build
npm run start
```

## Bestehende lokale `dev.db` (vor Einführung von Migrations)

Wenn du schon eine Datenbank ohne `_prisma_migrations` hattest, einmalig als angewendet markieren:

```bash
DATABASE_URL=file:./dev.db npx prisma migrate resolve --applied 20260418120000_init
```

Danach wie gewohnt `prisma migrate deploy` nutzen.

## Release

Git-Tag für diese Version: **`EMS_v1.0`** (Paketversion: `1.0.0`).
