# CLAUDE.md

> Standing brief for Claude Code working in the Cadence codebase. Read at the start of every session, before any audit, before any file edit.

This file holds the rules, constraints, and conventions that apply to every piece of work in this repo. It is not the product spec — that's the Project Bible. It is not the per-session prompt — that comes from Will or Claude (chat). It is the **invariant context**: things that are true in every session, that don't get re-litigated.

If anything in this file contradicts an incoming prompt, surface the contradiction before acting. Do not silently follow either.

---

## Where to find the canonical documents

- **Project Bible v2.0 + Bible v2.1 addendum** — the product spec. Read both.
- **Workflow v1.0** — the six-stage pipeline (Capture → Distill → Synthesise → Conceptualise → Ratify → Build). This file is execution-domain only; everything strategic lives upstream.
- **Brand Reference** — voice, visual, motion. Binding on every commit.
- **agents.md** — how Will works, how he sounds, what he expects.
- **Feature Concepts** — the per-feature ratified specs. Each implementation prompt references a specific FC by ID.

Live in `/Cadence/00 — Bible/` and `/Cadence/01 — Brand/`.

---

## The session loop (non-negotiable)

Every Claude Code session follows this shape. Already specified in agents.md and bible §08 — repeated here because it's the single most important habit.

1. **Read first.** Before writing any code, read the files named in the prompt's pre-work section. No exceptions. No "I already know this codebase well enough."
2. **Audit before code.** Produce Steps 1 through N as a plan. Flag any decision that needs ratification. List risks.
3. **Wait for green light.** Will (with Claude in chat) ratifies the audit or sends it back. Do not proceed without ratification.
4. **Commit per logical unit.** One commit = one coherent change. Not per file. Not per phase.
5. **`npx next build` between commits.** Mandatory. Build failures do not reach Vercel.
6. **Three-list self-check before push.** Spec gaps / out-of-spec risks / unratified style risks. Apply every time.
7. **Push to `cadence-rebrand`.** Never to `main`. Ever.

---

## Locked decisions (do not relitigate)

These are ratified in the Project Bible's Decision Archive (§11) and the v2.1 addendum's §03. They are not opinions; they are constraints. If a prompt asks for work that would violate one of these, stop and flag.

### Architectural

- **Single user.** Cadence has one user — Will. Do not add multi-user caveats, branching logic for "other users," or anti-pattern hedges. Phase 7 will handle multi-user; not now.
- **Permissive RLS.** Single-user posture. RLS exists but is permissive. Do not propose tightening unless explicitly part of Phase 7 hardening.
- **Plan shape is `{ weeks, meta }`.** Every plan consumer goes through `getCurrentWeek`. Do not propose reverting to bare arrays, even "just for this one component."
- **Single-week plans repeat indefinitely.** Special case in `getCurrentWeek` and `getPlanPosition`. Multi-week plans keep date-bounded behaviour.
- **Inline expand-to-edit for to-dos.** `CadenceDialog` is for confirmations only, never for editing. Editing surfaces expand in place. Hotfix-3e taught this; do not unlearn it.
- **Dashboard Fuel and Journal cards default to yesterday.** Fuel upgrades to today when today has data. Journal stays yesterday until today is written.
- **Migrations live in `supabase/migrations/`.** After committing a migration, push to Supabase — `git push` alone does not run migrations.

### Product structure

- **Four pillars:** Fitness, Health, Wealth, Productivity. Not "Optimisation" — that was the old name.
- **Cognition lives under Health.** Mindfulness, brain health, attention. Cross-references Productivity for planner work.
- **Wealth is manual-first.** Bank feed integration, AI categorisation, etc. — Phase 7 enhancements, not now.
- **Dashboard order is locked.** Content of individual rows can change (e.g. row aggregation), but row order does not.
- **Five KPIs framework lives in Fitness:** Strength, Muscular Endurance, Speed, Flexibility, Cardiovascular Endurance.
- **Circadian Rhythm is a Health subdomain.** Four levers: exercise, light, food timing, night routine.

### IA changes ratified in v2.1 addendum

These have been ratified but may not yet be implemented. Check current state of the codebase before treating any as already-done.

- **Pillars dropdown** as a fifth sidebar section. Contains per-pillar landing pages (Fitness, Health, Wealth, Productivity).
- **Training moves out of Today** into the Fitness pillar landing page.
- **TV mode** promoted to top-level above Today; removed from Analyse.
- **Analyse and Assistant** sections collapse-by-default. Today stays open by default.
- **Favourites/pinned pages** as a new sidebar primitive.
- **Dashboard stats row** displays weekly rolling average rather than yesterday's single value.
- **Dashboard calendar widget** mirrors diary appointments (training excluded; activity/rest day colour coding).
- **Personalisation questionnaire** as a new Settings sub-page.
- **Cadence Daily Download** as a hybrid-tone AI summary at the top of the journal — Phase 2 dependency.

---

## Brand discipline

Drawn from `brand-reference.md` and agents.md. Every commit honours these.

### Voice

- **Sentence case for headers.** Not Title Case. Not ALL CAPS except for label-style chrome (e.g. "PHASE 1").
- **British English everywhere.** Programme, not Program. Catalogue, not Catalog. Optimisation, not Optimization. Behaviour, not Behavior. This applies in code comments, commit messages, UI copy, and prompts.
- **No emojis. Ever.** Not in code, not in UI, not in commits, not in chat, not in error messages. The only exception is user-generated content where the user has typed an emoji themselves.
- **Brevity is a feature.** If a sentence can be shorter, make it shorter.
- **No corporate hedging.** "It might be worth considering perhaps" — no. Say what you think. Caveats at the end if needed.

### Banned words

Never use any of these in UI, copy, comments, commits, or assistant responses:

- journey, crush, smash, slay
- amazing, awesome, fantastic
- let's, I'd be happy to, As an AI
- literally / basically / actually (as filler)

### Preferred terms

- session (not workout)
- moved (not rescheduled)
- logged (not tracked)
- recovery (not readiness)
- noted (not understood)
- see you tomorrow (not have a great day)

### Visual

- **Token-based colours only.** Every hex value lives in `cadence-tokens.css`. No inline hex anywhere else. No Tailwind colour utilities that bypass tokens.
- **Three typefaces only.** Fraunces (display + hero numbers), Geist or Söhne (UI), JetBrains Mono (metadata). Do not add a fourth.
- **Tabular numerics for all data.** Numbers in tables, dashboards, and stats use `font-variant-numeric: tabular-nums` so columns align.
- **Light and dark are both first-class.** Every component renders correctly in both. TV mode defaults to dark.
- **Hardcoded `rgba()` is a smell.** Migrate to design tokens. Existing `--shadow-dropdown` token is the pattern.

### Motion

Five-principle motion language (from brand reference):

1. Slow-in (ease-out, never ease-in)
2. Breathing data (subtle continuous motion on live values)
3. No bounce (no spring overshoot)
4. Sequenced first paint (elements arrive in order, not all at once)
5. Voice motion (when the assistant "speaks," motion accompanies)

---

## Codebase conventions

Most of these I cannot verify without reading the codebase. Treat as **expected patterns** based on documented decisions; verify in first session and update this file if reality differs.

### Stack

- Next.js (SPA pattern — single root page, view-key state routing via `WGHub.jsx`)
- Supabase (Postgres + RLS + migrations in `supabase/migrations/`)
- Design tokens (`cadence-tokens.css`) + component styles in `components/cadence/cadence.css`
- Branch: `cadence-rebrand`. Never push to `main`.
- Deploy: Vercel preview per push.

### File organisation

Actual layout — no `src/` prefix:

```
app/                        ← Next.js app — single root page + API routes
│   page.js                 ← renders <WGHub> (SPA entry point)
│   layout.js               ← loads cadence-tokens.css globally
│   api/                    ← Next.js API routes (assistant, strava, whoop)
components/
│   WGHub.jsx               ← root component; owns view state + all data loading
│   cadence/                ← all Cadence UI components and CSS
│       Sidebar.jsx         ← nav groups + view-key buttons
│       DashboardShell.jsx  ← sidebar + main slot
│       cadence.css         ← all component styles (scoped to [data-cadence])
│       ...
design/
│   cadence-tokens.css      ← design tokens (:root CSS custom properties)
│   cadence-tokens.json     ← token source of truth
lib/                        ← utilities (db, plan, bmr, etc.)
supabase/
└── migrations/             ← SQL migrations, timestamp-prefixed
```

### Naming

- Files: kebab-case (e.g. `hrv-trend.tsx`, `plan-shape.ts`)
- Components: PascalCase exports
- Hooks: `useThing` (`useCurrentWeek`, `useDailyData`)
- Supabase tables: snake_case (e.g. `lifts`, `daily_data`, `training_plans`)
- Migrations: timestamped (e.g. `20260520120000_add_user_exercises.sql`)

### Component patterns

- **View routing is via view-key state, not file-system routes.** New "pages" are components rendered conditionally inside `WGHub.jsx`. There is no URL change on navigation. Adding a new view = new component + new `view === 'x'` case in the render switch + new nav item in `Sidebar.jsx`.
- **Editing is inline.** New editing surfaces use the expand-in-place pattern from Hotfix-3e. `CadenceDialog` is for confirmations.
- **Shape-changing audits must include a global consumer grep in pre-work.** If a data shape is changing, find every consumer first.
- **Three-list self-check** before push, every time. Spec gaps / out-of-spec / unratified style.

---

## Pre-push checks (mandatory)

Before every push, complete all three:

1. **`npx next build` passes locally.** No type errors. No build warnings about issues introduced by this change.
2. **Three-list self-check.**
   - **Spec gaps:** anything in the audit that was promised but not implemented?
   - **Out-of-spec risks:** anything implemented that wasn't in the audit?
   - **Unratified style risks:** any brand-discipline calls made without ratification?
3. **Migrations status.** If a migration was added: confirm it's in `supabase/migrations/`, confirm naming, confirm it has been pushed to Supabase (separate from `git push`).

If any of the three fail, do not push. Diagnose, fix, re-run the checks.

---

## What to do when uncertain

- **Pattern unclear in the codebase?** Read three similar existing files before proposing the new one. Match their pattern.
- **Brand decision unclear?** Read `brand-reference.md` §10. If still unclear, surface for ratification — do not invent.
- **Architectural ambiguity?** Read the Bible's Decision Archive (§11) and the v2.1 addendum's §03. If still unclear, surface for ratification.
- **Will says "the fix didn't work":** ask if he hard-refreshed before diagnosing further. This is in agents.md §7 of "Things that will trip you up." A real bug is a real bug; a stale cache is fifteen seconds.

---

## What this file does not cover

- Per-feature implementation specs — those come as implementation prompts referencing a Feature Concept ID.
- Phase plans — those live in the Bible.
- Research findings — those live in `/Cadence/03 — Research/`.
- Per-session priming — that lives in agents.md.

This file is the invariant context. Everything per-session, per-feature, per-research-topic lives elsewhere.

---

*Read this file at the start of every session. If you find yourself thinking "I don't need to read CLAUDE.md again," you're already partway to a brand violation.*
