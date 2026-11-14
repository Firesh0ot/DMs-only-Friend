# Container setup (Docker / GHCR)

Pull-and-run path for a LAN table (GM laptop + TV/tablet) or a host behind your own reverse proxy. Day-to-day coding still uses `npm run dev`. Packaging decisions: [ADR 0015](decisions/0015-docker-ghcr-packaging.md). Architecture notes that overlap: [Developing](developing/README.md#docker--table-deploy).

## Requirements

- Docker Engine + Compose v2
- Outbound pull access to `ghcr.io` (or build locally from this repo)
- A URL browsers can open (LAN IP + port, or HTTPS FQDN via your proxy)

## Quick start (GHCR)

```bash
cp .env.example .env
# edit PUBLIC_ORIGIN — scheme + host [+ port], no trailing slash
docker compose pull
docker compose up -d
```

Open `PUBLIC_ORIGIN` (default host port **8042**). Health: `GET /api/health`.

LAN without a `.env` file:

```bash
export PUBLIC_ORIGIN=http://192.168.1.10:8042
docker compose pull && docker compose up -d
```

Build locally instead of pulling:

```bash
PUBLIC_ORIGIN=http://localhost:8042 docker compose up -d --build
```

One-liner without Compose:

```bash
docker run --rm -p 8042:3001 \
  -e PUBLIC_ORIGIN=http://192.168.1.10:8042 \
  -v dms-data:/data \
  ghcr.io/firesh0ot/dms-only-friend:latest
```

## Ports and data

| Role | Value |
|---|---|
| Host publish (compose `PORT`) | **8042** by default |
| Container listen | **3001** (fixed in the image / compose env) |
| Image | `ghcr.io/firesh0ot/dms-only-friend` (`DMS_IMAGE_TAG`, default `latest`) |
| Volume | `dms-data` → `DATA_DIR=/data` (`dms.sqlite`, `uploads/`) |

Override the host side only: `PORT=9000 docker compose up -d` publishes **9000→3001**; set `PUBLIC_ORIGIN` to match what browsers open.

## `PUBLIC_ORIGIN`

Must be the URL clients actually use (scheme + host + optional port, **no** trailing slash). The server embeds it in GM invite / room links from the HTTP API. Screen and player links built in the browser already use `window.location.origin`.

Examples:

- LAN: `http://192.168.1.10:8042`
- Reverse proxy / FQDN: `https://vtt.example.com`

Wrong origin → invite links point at the wrong host even though the UI loads.

## Reverse proxy and WebSockets

TLS and the public FQDN stay on **your** reverse proxy. Compose does **not** ship Caddy or Traefik as a service. Point the proxy at host **8042** (or container **3001** on a shared Docker network) and set `PUBLIC_ORIGIN` to the public HTTPS origin.

### WebSockets required (“Joining room…”)

Live sync uses **Socket.IO** (WebSocket + HTTP long-polling fallback). The proxy must forward HTTP **`Upgrade`** / WebSocket. If upgrades are stripped, static assets and `/api/health` may work while the UI hangs on **Joining room…**.

**nginx** (upstream = published host port or container):

```nginx
location / {
  proxy_pass http://127.0.0.1:8042;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

**Caddy:** `reverse_proxy` upgrades WebSockets by default — point it at the same upstream and set `PUBLIC_ORIGIN`.

**Traefik (optional labels):** Compose exposes labels off by default. Enable against an existing Traefik:

```bash
# .env
TRAEFIK_ENABLE=true
FQDN=vtt.example.com
PUBLIC_ORIGIN=https://vtt.example.com
```

Traefik passes WebSockets by default — avoid middlewares that drop `Connection` / `Upgrade`. Put the container on Traefik’s Docker network when needed.

## Environment knobs

From [`.env.example`](../.env.example) and compose:

| Variable | Purpose |
|---|---|
| `PUBLIC_ORIGIN` | Public browser URL for API-built invite links |
| `PORT` | Host publish port (default `8042`) |
| `TRAEFIK_ENABLE` / `FQDN` / `TRAEFIK_*` | Optional Traefik labels |
| `DMS_IMAGE_TAG` | Image tag for `compose pull` |
| `HOST` / `DATA_DIR` / `UPLOADS_DIR` / `DMS_DB_PATH` / `CLIENT_DIST` | Server paths (image defaults are fine for compose) |

## Publish workflow

GitHub Actions [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml) builds and pushes to GHCR on `main` and `v*` tags. After packaging changes land on `main`, wait for that workflow, then `docker compose pull && docker compose up -d`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Hang on **Joining room…** | Proxy blocks WebSocket / `Upgrade` |
| Invite / GM link wrong host | `PUBLIC_ORIGIN` mismatch |
| Empty maps after restart | Volume not mounted / wrong `DATA_DIR` |
| Pull denied from GHCR | Package visibility / auth; build with `docker compose up -d --build` instead |
