# Cadence — Project Working Notes

This repo is the implementation of Cadence (formerly WG Hub).

The design system lives in `design/`. Mockups in `design/mockups/` are the authoritative target visual states. Tokens in `design/cadence-tokens.css` are the source of truth for all colours, typography, spacing, and motion.

Brand voice and visual principles: `design/brand/`.

## Rules for any work on this repo

1. **The mockup files in `design/mockups/` are the literal specification, not inspiration.** Copy them section-by-section, class-by-class. The mockup IS the design — your job is to port it into Next.js and wire it to real data, not to redesign.

2. **Use tokens from `design/cadence-tokens.css` exclusively.** No hardcoded colours, fonts, or spacing values anywhere in the codebase. If a value doesn't exist as a token, ask before adding it.

3. **Follow the voice rules in `design/brand/cadence-brand-reference.md`.** Sentence case (e.g. "Daily data" not "DAILY DATA"), British English, dry, capable. Match the mockup's exact strings — don't paraphrase microcopy.

4. **Match the animation system patterns defined in the mockups.** This includes `.r .r-1` through `.r-10` staggered reveals, body fade-in on page load, theme crossfade, and any per-page animations (count-up, line-draw, bar-grow, dot-pulse). Don't invent new animations.

5. **Numbers are Ink.** Moss is reserved for moments of meaning — the wordmark dot, primary buttons, "go" states, positive deltas, the moss section-border accent. Moss is never decoration. Numbers are never red, orange, blue, green, purple, or any other colour.

6. **The existing data wiring is preserved.** `lib/`, `app/api/`, Supabase queries, Strava OAuth, Whoop upload — all stay intact. Only the presentation layer changes. The mockup tells us *how* to display data; the existing code tells us *what* data to fetch.

7. **Work happens on the `cadence-rebrand` branch.** Production lives on `main`. Never push to `main` from a rebrand session. `main` only updates when the full rebrand is reviewed and merged via PR.

## Per-session workflow

Every page rebuild session follows the same pattern:

1. **Audit before build.** List every section in the mockup. List the data sources for each. Commit to the brand rules above in your own words. Propose an implementation plan. Wait for user approval before writing any code.

2. **Build.** Execute the approved plan. One commit per logical unit of work.

3. **Self-check before push.** Compare your implementation against the mockup. List anything in the mockup that's missing from your implementation. List anything in your implementation that isn't in the mockup. List every colour or styling decision you made that wasn't directly specified by the mockup. If any list is non-empty, fix or flag before pushing.

4. **Push to `cadence-rebrand`.** Never to `main`.

## When the rebrand is complete

After every page is rebuilt and verified, open a Pull Request from `cadence-rebrand` to `main`, review the full diff, merge. That's the moment production switches over to Cadence.
