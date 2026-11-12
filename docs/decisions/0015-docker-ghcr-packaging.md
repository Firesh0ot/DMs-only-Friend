# 0015 — Docker and GHCR packaging

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Table deploy should be a pull-and-run path for LAN sessions (GM laptop + TV/tablet), without requiring a local Node toolchain. Oliver is making the GitHub repo public so GitHub Container Registry (GHCR) publish works with `GITHUB_TOKEN`. Operators already run a reverse proxy; the app should not ship a bundled TLS stack.

## Decision

- Ship a multi-stage `Dockerfile` that builds the npm workspaces monorepo and runs the production Node server, which also serves the Vite client build.
- **Production Node deps:** dedicated `prod-deps` stage runs `npm ci --omit=dev -w @dms/server -w @dms/shared` (native toolchain for `better-sqlite3`). The runtime stage copies **root** `node_modules` **and** workspace-nested `server/node_modules` / `shared/node_modules`. Do not copy only the hoisted root tree after `npm prune` — npm nests conflicting majors (e.g. server `nanoid@5` vs client/vite `nanoid@3` under `server/node_modules`), and prune drops the root copy used only by pruned client tooling.
- Persist SQLite and uploads under `DATA_DIR` (default `/data` in the image): `dms.sqlite` + `uploads/`.
- Provide `docker-compose.yml` for local/LAN deploy with a named volume, default host publish **8042→3001**, and `PUBLIC_ORIGIN` for invite-link generation.
- FQDN/TLS live on the operator’s existing reverse proxy; optional Traefik Docker labels (`TRAEFIK_ENABLE`, `FQDN`) attach when wanted — no bundled Caddy/Traefik service.
- Publish images to `ghcr.io/firesh0ot/dms-only-friend` on pushes to `main` and `v*` tags via GitHub Actions (`packages: write` + `GITHUB_TOKEN`).

## Consequences

- First-table tests can use compose one-liners against GHCR without installing Node.
- Operators must set `PUBLIC_ORIGIN` to the LAN IP or public HTTPS origin used by browsers (invite links from the HTTP API).
- GHCR package visibility / Actions package permissions may still need a one-time enable after the repo is public.
- Native `better-sqlite3` is compiled in the `prod-deps` stage (bookworm); runtime stays on Debian bookworm-slim with that built addon.
- Image runtime deps stay server/shared-scoped (no Pixi/React in the Node tree); nested workspace `node_modules` must remain in the image whenever the lockfile nests packages.
