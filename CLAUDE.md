# Project: Warehouse Sim
Mode: hackathon

Working name for the NVIDIA hackathon project. The PRD calls it ShiftWorld; don't use that name in code or UI yet.
Next.js 16 (App Router), React 19, TypeScript 5 strict, Tailwind CSS 4, Biome, Vitest.

@AGENTS.md

## Product
- Source of truth: `docs/idea_intro.md` (PRD v2, text extracted from `docs/idea_intro.docx`). The diagrams are in `docs/idea-diagrams/`.
- A warehouse decision-rehearsal simulator. Independent operational agents (driver, dock lead, yard controller, and more later) talk through structured messages and negotiate commitments. An authoritative engine owns physical state, reservations and logical time. A supervisor sets policy and handles escalations, but does not pick every action.
- Agent runtime: NVIDIA models through Nebius. Check model IDs, tool-call schema and pricing against current official docs before configuring them.
- Reference facility: DFW Commerce Center Building I (source S1): 182 dock-high doors, 4 ramp doors, 235 trailer spaces.
- Visuals: blocky low-poly 3D with flat colors. Start from primitives; assets are optional.

## Non-negotiable product rules
- Never invent operational numbers. Unknown values stay explicitly unknown, never 0 and never a plausible default, through save, reload and export.
- Every numeric input carries an evidence record: source, unit, date, classification and interpretation.
- Synthetic test fixtures are labeled synthetic and never appear as facility data.
- LLM output never mutates state directly. It goes only through the engine's tool contracts: validate, commit atomically, idempotent request IDs.
- Rendering never decides outcomes. The engine and agents must work with graphics disabled.
- The facility layout is schematic until a site plan is traced, and the UI must say so.

## Task tracking
- Hackathon build tasks live in Beads (`bd`), prefix `ws`. Read `docs/beads.md` before picking work.
- Loop: `bd dolt pull` → `bd ready -l <lane>` → `bd update <id> --claim` → implement the plan task named in the bead → `bd close <id> -r "<commit>"` → `bd dolt push`.
- Ownership per lane: `docs/feature-split.md`. Never edit files owned by the other lane.

## Commands
- `pnpm dev`: start the dev server (localhost:3000)
- `pnpm build`: production build
- `pnpm lint`: biome check
- `pnpm format`: biome format --write
- `pnpm test`: vitest (engine invariants are the core logic to test)

## Project structure
- `app/`: Next.js App Router (layouts, pages, loading, error, not-found)
- `app/api/`: Route Handlers (API endpoints)
- `components/ui/`: shadcn/ui primitives (do not edit directly)
- `components/`: app-specific components
- `hooks/`: custom React hooks
- `lib/`: engine, agents, evidence model, utilities
- `actions/`: Server Actions
- `types/`: shared TypeScript types

## Code standards
- TypeScript strict mode. Never use `any`; use `unknown` and narrow.
- Named exports only, except where Next.js requires default exports (pages, layouts, error).
- Arrow function components. Destructure props with an explicit interface.
- Tailwind utility classes only. No custom CSS files, no inline `style={}`.
- Server Components by default. Add `"use client"` only for interactivity, browser APIs and the 3D scene.
- Zod for all input validation: imports, API route inputs, env vars, and agent tool-call payloads.
- `metadata` exports on every `page.tsx`.

## Architecture rules
- The engine is pure, deterministic TypeScript under `lib/` with no React or rendering imports, so it can be tested and replayed headless.
- Secrets (the Nebius API key) are server-side only. Prefix public vars with `NEXT_PUBLIC_`.
- Never commit `.env` or `.env.local`. Document required vars in `.env.example`.
