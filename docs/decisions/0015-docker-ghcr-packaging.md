# 0015 — Docker and GHCR packaging

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Table deploy should be a pull-and-run path for LAN sessions (GM laptop + TV/tablet), without requiring a local Node toolchain. Oliver is making the GitHub repo public so GitHub Container Registry (GHCR) publish works with `GITHUB_TOKEN`.

## Decision

- Ship a multi-stage `Dockerfile` that builds the npm workspaces monorepo and runs the production Node server, which also serves the Vite client build.
- Persist SQLite and uploads under `DATA_DIR` (default `/data` in the image): `dms.sqlite` + `uploads/`.
- Provide `docker-compose.yml` for local/LAN deploy with a named volume, default host publish **8042→3001**, and `PUBLIC_ORIGIN` for invite-link generation.
- Publish images to `ghcr.io/firesh0ot/dms-only-friend` on pushes to `main` and `v*` tags via GitHub Actions (`packages: write` + `GITHUB_TOKEN`).

## Consequences

- First-table tests can use compose one-liners against GHCR without installing Node.
- Operators must set `PUBLIC_ORIGIN` to the LAN IP or public URL used by browsers (invite links from the HTTP API).
- GHCR package visibility / Actions package permissions may still need a one-time enable after the repo is public.
- Native `better-sqlite3` is compiled in the build stage; runtime stays on Debian bookworm-slim with the built addon.
