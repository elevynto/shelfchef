# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Frontend**: React + TypeScript (Vite) — `apps/web`
- **Backend**: Express + TypeScript — `apps/api`
- **Database**: MongoDB (Mongoose)
- **Testing**: Vitest (unit/integration), Playwright (e2e)
- **Monorepo**: `apps/web`, `apps/api`, `packages/shared` (npm workspaces)

## Commands

```bash
# Dev
npm run dev           # start api + web concurrently
npm run dev:api       # ts-node-dev server only
npm run dev:web       # Vite dev server only

# Test (prefer targeted first, then broader)
npm run test                    # all tests (all 4 vitest projects)
npm run test:unit               # shared + api-unit + web
npm run test:integration        # api-integration only
npm run test:e2e                # Playwright e2e (requires running app)
npx vitest run path/to/file     # single file

# Build & lint
npm run build
npm run lint
npm run typecheck
```

## Always-On Rules

- **No new dependencies without justification** — explain the need and why an existing dep doesn't cover it.
- **Targeted tests first** — run the smallest relevant test scope before running the full suite.
- **Use `gh` CLI** for all GitHub tasks (issues, PRs, checks). Do not use the GitHub web UI.
- **TypeScript strict mode** — no `any`, no ts-ignore without a comment explaining why.
- **Shared types in `packages/shared/`** — types used by both apps live in `packages/shared/src/types/`.
- **Keep CLAUDE.md under 200 lines** — move reusable workflows to skills instead.

## Architecture Decisions

- Express server is a thin API layer; business logic lives in service modules (`apps/api/src/services/`).
- Mongoose models are the single source of truth for DB schema; no raw MongoDB queries outside models.
- React Query handles all client-side data fetching and caching; no `useEffect` for data fetching.
- `packages/shared` is referenced via TypeScript path aliases — no build step needed during development.
- `apps/api/src/server.ts` exports `createApp()` without `.listen()` — used by Supertest in tests.

---

## Compact Instructions

> Update this section as the project evolves. Captures current state for continuity across sessions.

### Current Feature Slice
Slice 5 — Pantry-to-recipe matching

### Open Risks
- `mongodb-memory-server` downloads a MongoDB binary on first test run — may be slow in CI on cold cache.
- Spoonacular API key required for recipe search; not available in local dev without `.env`.

### Running the App
```bash
docker-compose up -d   # start local MongoDB
npm install
npm run dev
```

### Running Tests
```bash
npx vitest run --workspace vitest.workspace.ts          # all 4 projects, no watch
npx vitest run --workspace vitest.workspace.ts --project shared   # targeted
npm run test:e2e                                         # requires app running
```
