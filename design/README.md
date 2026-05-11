# Cadence Design Tokens

**Version 1.0 · May 2026**

Single source of truth for the Cadence visual system. Every colour, every font, every animation timing — defined once, used everywhere.

---

## Files in this set

| File | Format | Purpose |
|---|---|---|
| `cadence-tokens.css` | CSS custom properties | The canonical file. Link this from your app. |
| `cadence-tokens.json` | Structured JSON | For design tools, docs, type generators. Mirrors the CSS. |
| `cadence-tokens.md` | This document | Explains the system. |

The CSS file is the source. The JSON should be kept in sync — when one changes, update both.

---

## What are tokens, and why do we have them

A token is a named design decision. Instead of writing `#6B7A5A` everywhere you want the brand green, you write `var(--moss)`. The name *is* the decision; the hex code is just where it lives today.

**Three concrete reasons we use them:**

1. **One place to change a thing.** Shift moss to a warmer hue and every page updates. No hunting through six files for hex codes.
2. **Engineering and design stay in sync.** The colour in the React component is *literally the same* `--moss` as the one in the Figma library.
3. **Theming is mechanical.** Light → dark is just swapping a set of values. The dark theme exists because `[data-theme="dark"]` redefines the same tokens, not because dark mode is a separate codebase.

---

## How to use

### In HTML

Link the file once in `<head>`. Make sure you set the theme attribute on `<html>` before `<body>` paints, to prevent a flash of the wrong theme:

```html
<head>
  <script>
    (function() {
      var stored = localStorage.getItem('cadence-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', stored || (prefersDark ? 'dark' : 'light'));
    })();
  </script>
  <link rel="stylesheet" href="cadence-tokens.css">
  <!-- your other styles -->
</head>
```

### In CSS

```css
.button {
  background: var(--moss);
  color: var(--on-moss);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-5);
  font-family: var(--sans);
  font-size: var(--type-body);
  transition: background-color var(--t-ui) var(--ease);
}
```

### In JavaScript / React

You can read CSS variables at runtime if needed:

```js
const moss = getComputedStyle(document.documentElement)
  .getPropertyValue('--moss').trim();
```

But the more common pattern is to let CSS do the work and only reach into JS for values that genuinely need to be in code (chart colour palettes, etc.).

---

## What the system covers

### Colour

Three semantic families:

**Surfaces** — the four backgrounds. `--bg` is the page, `--bg-card` is a section, `--bg-paper` is highest elevation (inputs, modals), `--bg-elevated` is the subtle hover state.

**Text** — five steps from `--text` (primary, the headlines) down to `--text-faint` (placeholder, disabled). Pick the lowest contrast that still passes legibility for the role.

**Brand & accent** — `--moss` is the one. Use it for things that mean something: primary actions, "go" states, positive deltas, the wordmark dot. `--clay` is for warnings. `--slate` is for comparison data. `--sand` is "approaching" / deload / in-progress. The data-viz palette (`--d1` through `--d7`) is for charts with multiple series.

**The rule of moss:** if you find yourself adding moss decoratively, stop. It earns its place by carrying meaning. A page with no moss on it is fine. A page where moss is everywhere isn't Cadence.

### Typography

Three families:
- `--display` (Fraunces) — headlines, hero numbers, the wordmark. The only family where numbers are typographic.
- `--sans` (Geist / Söhne / Inter) — interface, body copy, labels.
- `--mono` (JetBrains Mono) — metadata, timestamps, code, eyebrow labels. Never for the data itself.

**The number rule:** any meaningful number (PB, recovery score, target) is set in `--display` with tabular numerics. Timestamps are mono. Don't mix them up.

A type scale runs from `--type-9` (tiny meta) up to `--type-144` (TV mode hero). Pixel-named for predictability — `--type-14` is 14px. Semantic aliases sit alongside (`--type-body`, `--type-h1`, `--type-hero`).

### Spacing

12-step scale on a 4px base. `--space-1` is 4px, `--space-12` is 72px. Most components use `--space-4` to `--space-8` for internal padding.

### Border radius

Four steps. `--radius-md` (4px) is the default for buttons and inputs. `--radius-lg` (6px) for cards. `--radius-xl` (8px) only for large surfaces (TV mode tiles).

### Motion

One easing curve (`--ease`), five durations:
- `--t-ui` 240ms — buttons, toggles, focus rings
- `--t-fade` 280ms — TV mode data fades
- `--t-theme` 320ms — light/dark crossfade
- `--t-paint` 900ms — first-paint staggered reveals
- `--t-cycle` 20s — TV mode auto-advance interval

**The motion rule:** cadence's motion is "slow in, quicker out". No spring, no bounce, no overshoot — except inside the iOS app where springs match platform expectation.

### Z-index

Five layers. Use the named tokens; never write `z-index: 9999`.

---

## Adding a new token

Before adding, ask: *can an existing token do this job?* Usually yes. If genuinely not:

1. **Pick the right family.** A new colour is in colour. A new timing is in motion. Don't invent new categories.
2. **Use a semantic name.** Name it what it's for, not what it looks like. `--alert-bg`, not `--pinkish`.
3. **Add to both files.** CSS and JSON must stay in sync.
4. **Document the intended use.** A token without a use note isn't really a token.
5. **Check the dark theme.** Every colour token needs a dark-theme override (or a deliberate decision that it's theme-agnostic).

## Removing a token

Be careful. Removing a token is a breaking change for any component using it. Grep before deleting.

---

## What's NOT in tokens (and why)

A few things you might expect to find but don't:

- **Shadows.** Cadence is restrained with shadows — the current system uses one (`box-shadow: 0 10px 28px rgba(0,0,0,0.08)` on dropdowns). If we use shadows in more than one place, tokenise.
- **Component-specific values.** A button's height, an input's padding — these belong in component styles, not global tokens. Tokens are atoms, not molecules.
- **Animation keyframes.** Easing and duration are tokens. The specific keyframes (`@keyframes drawLine`, etc.) live with the components that use them.

---

## File ownership

The CSS file is the source of truth. If you're adding a token:

1. Add to `cadence-tokens.css` first.
2. Add to `cadence-tokens.json` second.
3. Update this doc if you've added a category.
4. Don't add tokens inside other CSS files. They go here.

---

## Future work

A few things this set deliberately doesn't include yet, listed here so we don't lose them:

- **TypeScript types** for tokens, so React code gets autocomplete and prevents typos.
- **Tailwind config** generated from the tokens, if the implementation goes that way.
- **Figma library** that imports the JSON, keeping design and code mechanically synced.
- **Token aliases for component slots** — e.g. `--button-primary-bg` aliasing to `--moss`. Useful for component-level theming, overkill for now.

---

*Cadence Design Tokens · v1.0 · End of file*
