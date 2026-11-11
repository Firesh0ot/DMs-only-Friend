# 0001 — Docs strategy (repo manuals + Context pointers)

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The project needs durable manuals for players and developers, plus decision history agents can trust. Cursor Project Context holds working prefs and pointers; the git repo should own the canonical how-tos and ADRs so they travel with the code.

## Decision

- **Repo manuals** live under `docs/` and are the source of truth for Playing, Developing, and Decisions.
- **Context pointers** (Project store `docs/`) link to those repo paths; they do not duplicate manuals.
- **Playing** manuals ship in **English and German** (`docs/playing/en/`, `docs/playing/de/`). Audience: GM and **remote players** (table-first, remote secondary).
- **Developing** guide is **English only** (`docs/developing/`).
- **ADRs** live in `docs/decisions/` (English), with an index and naming convention `NNNN-short-kebab-title.md`.
- Update manuals and ADRs on **preference or architecture changes** and at **phase/milestone closes**, not on every merge.

## Consequences

- Agents and humans look first at repo `docs/` for how-to and rationale; Context stays thin.
- Bilingual Playing increases maintenance cost but matches the project’s DE/EN audience.
- Leaf PRs need not touch docs unless they change prefs, architecture, or close a milestone.
