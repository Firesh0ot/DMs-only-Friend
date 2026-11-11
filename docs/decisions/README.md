# Architecture Decision Records

Index of ADRs for DMs-only-Friend. ADRs are written in **English**. They capture significant preference and architecture choices so humans and agents share the same rationale.

## When to write or update

- Preference or architecture changes that affect how we build or ship.
- Phase or milestone closes.
- **Not** every merge or leaf PR.

## Naming

Files: `NNNN-short-kebab-title.md` (zero-padded sequence, e.g. `0001-docs-strategy.md`).

## Template

Each ADR should include:

```markdown
# NNNN — Title

- **Status:** proposed | accepted | superseded
- **Date:** YYYY-MM-DD

## Context

Why the decision came up.

## Decision

What we chose.

## Consequences

What becomes easier, harder, or out of scope.
```

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-docs-strategy.md) | Docs strategy (repo manuals + Context pointers) | accepted |
| [0002](0002-phase1-table-core.md) | Phase 1 table-core decisions | accepted |
| [0003](0003-prep-play-ux.md) | Prep Settings and Play control islands | accepted |
| [0004](0004-session-battle-log.md) | Session / battle event log | accepted |
