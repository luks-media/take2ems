# EMS v1.0 — Deployment

## Voraussetzungen

- Docker und Docker Compose (für den mitgelieferten Stack; das Image basiert auf **Debian bookworm-slim**), oder Node 20 LTS für manuellen Betrieb
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

Falls `npm run build` im Image fehlschlägt: Im Builder gibt es **keine `.env`** — deshalb legt das `Dockerfile` eine **temporäre SQLite-Datei** unter `/tmp` an und führt **`prisma migrate deploy`** vor `next build` aus. Bei weiteren Fehlern: `tail -n 80 build.log` (oder die Docker-Build-Ausgabe) prüfen.

### `failed to execute bake: signal: killed` (langer Build, dann Abbruch)

Typisch: **zu wenig RAM** auf dem VPS — der Linux-Kernel beendet den Build (OOM). Gegenmaßnahmen:

1. **Swap** anlegen (Beispiel 2 GB auf Ubuntu), dann Build erneut starten:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

Dauerhaft in `/etc/fstab` eintragen: `echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`

2. **Mehr RAM** beim Provider wählen (z. B. 4 GB), oder das Image auf einem **stärkeren Rechner** bauen und per Registry auf den Server pushen.

Im Repo ist `next.config` so eingestellt, dass Webpack beim Production-Build **weniger parallel** arbeitet (`parallelism: 1`), und das Dockerfile setzt einen **moderaten** Node-Heap — das entlastet kleine Maschinen.

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

## Changelog (Kurz)

### v1.1.0

- Neues Aktivitäts-Log in `Settings` mit Detailfenster pro Eintrag (inkl. Filter und Redaction sensibler Daten).
- Überfällige Rückgaben blockieren Verfügbarkeit zuverlässig, bis auf `Zurückgegeben`/`Storniert` gesetzt.
- Dashboard: Button `Zurückgegeben` bei überfälligen Rückgaben für schnellen Abschluss.
- Ausleihen werden automatisch auf `Aktiv` gesetzt, sobald das Startdatum erreicht ist.
- UI-Verbesserungen: User-Profilzugang in die Sidebar verlegt, Versionsnummer unten in `Settings`, konsistente Umlaute.

## Release

Git-Tag für diese Version: **`EMS_v1.1.0`** (Paketversion: `1.1.0`).
