# Cadence — Brand Guidelines

**Version:** 1.0 · May 2026
**Status:** Working draft
**Surfaces:** Web · iOS · Voice
**Recommended use:** Paste into project briefs, design tool context, AI assistant prompts, or developer specs.

---

## 00. Document purpose

This is the working reference for Cadence — a personal performance platform and AI assistant. It captures the brand's name, foundations, personality, visual system, motion principles, data-visualisation language, written tone of voice, and sonic identity. It should be loaded into context whenever designing or building a Cadence surface — the web app, iOS app, marketing site, or assistant voice.

The brand serves two intertwined product halves:

1. **The Fitness Hub** — a premium dashboard pulling live data from wearables (Whoop, Strava) plus manual inputs, presenting it through configurable charts, reports, and an ambient TV-mode display.
2. **The AI Personal Assistant** — a true assistant with long-term memory of the user's training, journal, calendar, email, and conversations. Communicates by text, in-app voice, and real phone calls (incoming and outgoing).

The brand should feel like it could sit alongside Whoop, Linear, Superhuman, Notion, or Pi without looking out of place — and unlike any of them.

---

## 01. The Name — Cadence

### Why Cadence

A single word holding three meanings the product needs at once:

1. **The rhythm of a runner's steps.** Strides per minute — the most quietly important number in endurance sport, measured by every wearable in this category.
2. **The rhythm of speech.** The pace and lilt of a voice. The product's AI assistant literally *has* a cadence — it is how it will be heard.
3. **The rhythm of work.** What gets diarised gets done. What gets analysed gets perfected. The product gives the user a steady, productive cadence across training, work, and life.

### Why it works

- Premium without being precious. A domain term, not a mascot.
- Athletic without being gym-bro. Endurance sport, not weightlifting.
- British, quiet, three syllables, no shouting.
- Unowned in the category — Whoop, Oura, Strava, Notion, Linear — Cadence sits alongside them cleanly.
- Scales from one user to a public product without re-meaning.
- Pronounceable, memorable, dictatable to Siri on the first try.

### Wordmark

Set in lowercase Fraunces, weight 360, optical size 144, soft axis 60, with a moss-green terminal full stop. The lowercase reads as personal; the full stop reads as resolved.

### Alternative names considered

| Name | Tilts the brand toward | Why not chosen |
|---|---|---|
| **Mile** | Declarative, monosyllabic, British | Thinner conceptually for an AI assistant — the assistant is not a unit |
| **Tally** | Quietly British, charming, tracking-focused | Risks reading too domestic against premium tech competitors |
| **Heron** | Patient observer (British wading bird) | Animal mascots are crowded; risks lifestyle-blog tonality |
| **Atlas** | Cartographic, knowing, holding-the-world | Overused (Atlassian, Atlas Obscura, Boston Dynamics); domain scarcity |

---

## 02. Foundations

### Mission

To give one person — and eventually anyone — the data, the discipline, and the daily companion to live and train at the level they choose.

### Positioning

Cadence sits at the intersection of wearable-driven performance (Whoop, Strava, Oura), second-brain productivity (Notion, Linear, Superhuman), and conversational AI (Pi, Claude). It is the first product that does not sit in any one of those categories — it sits across them.

### Product, in one sentence

> A premium dashboard for the body, a calm assistant for the day, and one voice connecting both.

### The two principles (the founder's, now the brand's)

> *What gets diarised gets done.*
> *What gets analysed gets perfected.*

Every design decision — every chart, every microcopy line, every animation — should serve one of these or both. If it does neither, it should not ship.

### Audience

- **Today:** one ultra-runner who runs a business and values friction-free interfaces above almost everything.
- **Tomorrow:** a small public of operators, athletes, and senior individual contributors who want the same.

---

## 03. Personality

Six dispositions. The right column should not appear in any Cadence artefact.

| Cadence is | Cadence is not |
|---|---|
| Premium | Aloof / condescending |
| Athletic | Gym-bro / shouty |
| Intelligent and warm | Clinical / cold |
| Quietly confident | Trend-chasing / hype-driven |
| Functional and beautiful at once | Beauty hiding broken function |
| Personal | Corporate / committee voice |

---

## 04. Logo system

### Primary wordmark

Lowercase `cadence.` in Fraunces — weight 360, optical size 144, soft axis 60, letter-spacing -0.045em. The terminal full stop is filled with Moss (#6B7A5A). **The full stop is part of the mark, not a decoration.** It is what distinguishes the wordmark from the typeface.

### Monogram / app-icon mark

A single character formed from two arcs and a small moss dot. It reads as a `c`, a metronome's swing, and a pair of footfalls. Designed to remain legible at 16 × 16 px.

### Versions

- **Primary:** Ink wordmark on Bone background.
- **Inverse:** Bone wordmark on Ink background.
- **Mono:** Bone wordmark on Moss background (icon, splash screen).
- **Monogram:** Standalone for favicons, app icons, and below 18px width.

### Clear space and minimum sizes

- Clear space around any mark: equal to the height of the lowercase `c` counter.
- Minimum wordmark width: 18px.
- Minimum monogram size: 16px.
- Below these sizes, use the monogram alone.

### Never do

- Set the wordmark in any other typeface, weight, or case.
- Tilt, skew, or stretch the mark.
- Remove the moss dot.
- Recolour the wordmark to anything other than Ink, Bone, or Moss.
- Place over a busy photograph without a solid hold-out.

---

## 05. Colour system

The palette is built around warm neutrals and a single accent. Light pastels of bone and stone carry the surfaces; moss carries decision. A clay second accent earns its place sparingly.

### Light theme — surfaces

| Token | Hex | Use |
|---|---|---|
| Bone | `#F5F2EC` | Primary background |
| Bone Soft | `#FBFAF5` | Elevated surface (cards) |
| Paper | `#FFFFFF` | Highest elevation (modals, dropdowns) |
| Stone 50 | `#EDE9E0` | Hairline dividers, subtle fills |
| Stone 100 | `#DCD7CB` | Borders, grid lines |
| Stone 200 | `#B8B3A7` | Disabled, secondary borders |
| Stone 300 | `#8A867D` | Tertiary text, axis labels |
| Stone 400 | `#5F5C55` | Secondary text |
| Ink | `#1B1B1F` | Primary text |
| Ink Soft | `#2E2E33` | Body text |

### Accents

| Token | Hex | Use |
|---|---|---|
| Moss | `#6B7A5A` | Brand colour — wordmark dot, primary buttons, "go" states, positive deltas |
| Moss Deep | `#4F5A42` | Moss text on bone (AA-compliant) |
| Moss Soft | `#C9CFB9` | Selected-state fill |
| Clay | `#B96A4D` | Warnings, alerts, missed sessions, negative deltas |
| Clay Deep | `#A3493D` | Clay text on bone (AA-compliant) |
| Clay Soft | `#E8C7B5` | Alert backgrounds |
| Slate | `#4A5F6E` | Secondary data series, baselines |

### Dark theme

Inverse, not absent. Warmer than typical pure-black tech apps; the base carries a hint of warmth. Moss lifts slightly in luminance to maintain contrast.

| Token | Hex | Use |
|---|---|---|
| Ink Deep | `#13141A` | Primary background |
| Ink | `#1B1B22` | Card surface |
| Surface | `#25262E` | Elevated surface |
| Stone | `#6F6B62` | Tertiary text |
| Bone | `#F5F2EC` | Primary text |
| Moss Lift | `#8DA075` | Moss accent — lifted for dark backgrounds |

### Accessibility

- Body text on bone passes AAA at all sizes (Ink #1B1B1F on Bone #F5F2EC = 16.1:1 contrast).
- Moss is for non-text accents in light mode; for text it darkens to Moss Deep (#4F5A42, passes AA at 14pt+).
- Clay on bone passes AA for non-text only (3:1). For text, use Clay Deep #A3493D.
- All data-viz pairings tested for tritanopia and deuteranopia distinguishability.

### Dark mode philosophy

Dark mode is not a toggle stuck in the settings menu. It is a first-class surface and should be designed *for*, not against. **The ambient TV-mode display defaults to dark.**

---

## 06. Typography

Three families, three jobs.

### Display — Fraunces

A contemporary editorial serif with a soft optical axis. Used for headlines, hero numbers, and the wordmark.

- **Settings:** opsz 144 for display sizes, soft 50–60 for warmth, weight 320–380.
- **Licence:** Open-source via Google Fonts. Free for commercial use.

### UI Sans — Söhne (production) / Geist (open-source) / Inter (fallback)

A high-quality neo-grotesque for interface, body copy, and labels.

- **Söhne** — production preference. Commercial licence required (~$300, Klim Type Foundry). Used by OpenAI, Vercel.
- **Geist** — open-source recommendation. Designed by Vercel; free.
- **Inter** — fallback when neither is available. Free, on Google Fonts.
- **Weights used:** 400, 500, 600.

### Mono — JetBrains Mono

For metadata, timestamps, unit indicators, code, and labels. Open-source. **Tabular numerics on by default for all data.**

### Type scale (web, 16px base)

| Role | Size / line-height | Family | Letter-spacing |
|---|---|---|---|
| Hero | 112 / 0.95 | Fraunces 360 | -0.04em |
| H1 | 72 / 0.95 | Fraunces 380 | -0.035em |
| H2 | 48 / 1.05 | Fraunces 400 | -0.025em |
| H3 | 28 / 1.15 | Fraunces 400 | -0.015em |
| Hero number | 64–96 / 1.0 | Fraunces 400, tnum | -0.025em |
| Body | 16 / 1.55 | Söhne / Geist 400 | -0.005em |
| Body S | 14 / 1.5 | Söhne / Geist 400 | 0 |
| Caption | 12 / 1.4 | Söhne / Geist 400 | 0 |
| Button | 14 / 1.0 | Söhne / Geist 500 | 0 |
| Label | 11 / 1.4 | JetBrains Mono 500 | 0.16em, uppercase |
| Stamp | 12 / 1.4 | JetBrains Mono 400, tnum | 0 |

### Typographic principles

- **Numbers are typographic.** Any meaningful number — a personal best, a recovery score, a target — is set in Fraunces with tabular numerics. We set numbers the way we set headlines.
- **Mono for metadata, never for data.** Timestamps and labels are mono. The number itself is display.
- **Letter-spacing tightens with size.** -0.04em at hero, -0.025em at H2, -0.005em at body, 0 at caption.
- **Optical sizing is on.** Both Fraunces and Söhne support optical sizing — use it.

---

## 07. Iconography

- **Style:** Linear, no fills (except selected state).
- **Stroke weight:** 1.5px on a 24-grid; scales proportionally.
- **Terminals:** Rounded line-cap, rounded line-join.
- **Corner radius:** 2px on rectangles; full circles preferred to rounded squares.
- **Selected state:** Introduce a fill in Moss Soft (#C9CFB9).
- **Rule:** One concept per icon. If two glyphs are needed to explain, the icon is wrong.
- **Starting library:** Lucide. Replace any glyph that doesn't match the rules above.

---

## 08. Motion principles

Motion is a first-class brand element. The product contains live, real-time, animated data — motion is the brand in time.

### Five principles

1. **Slow in, quicker out.** Default easing: `cubic-bezier(0.2, 0.7, 0.2, 1)`. UI changes: 240ms. First-paint reveals: 800–1200ms.
2. **Data updates breathe.** When a number changes (heart rate, recovery, pace), it transitions across 600–900ms with the new value counted up or down. The data feels alive, not refreshing.
3. **No bounce, no overshoot.** Cadence is not springy. Spring easings are forbidden except inside the iOS app where they match platform expectation.
4. **First paint is a sequence.** Content arrives in order: structure → labels → data → accents. Each element offset by 60–80ms. The page is composed in front of the user, not delivered all at once.
5. **Voice has motion too.** Three visual states for the assistant:
   - **Listening:** soft moss-coloured pulse at 0.4Hz (slower than a resting heartbeat).
   - **Thinking:** the pulse becomes a horizontal line that lengthens and shortens.
   - **Speaking:** the line responds to vocal amplitude.

   These three states are the entire visual vocabulary of the assistant.

---

## 09. Data visualisation

**The data is the brand.** More than logo, more than colour: the way Cadence displays a heart-rate curve is how the brand is felt every morning.

### Categorical palette (for data series)

| Token | Hex | Default use |
|---|---|---|
| D1 — Moss | `#6B7A5A` | Primary series, always |
| D2 — Clay | `#B96A4D` | Secondary; comparison or alert |
| D3 — Slate | `#4A5F6E` | Tertiary; baseline / target |
| D4 — Sand | `#C9A24E` | Fourth series only |
| D5 — Mauve | `#8A7396` | Fifth |
| D6 — Stone | `#5F5C55` | Historical / faded |
| D7 — Brick | `#A3493D` | Extreme / negative-emphasis |

### Rules

- Never use more than three series on a single chart by default.
- Reserve the gradient fill (18% → 0%) for the primary series only; comparators are line-only.
- Grid lines are dashed Stone 100 at 1px. Baselines are solid.
- Highlight a point with an Ink dot and a 6px halo.
- Tooltips appear in a paper card on hover.
- Axis labels are mono, 10px, Stone 300.

### The inversion — the number is the story

In Cadence, the chart is supporting evidence for the number, not the other way around. Hero numbers — recovery score, weekly load, resting HR — are set in Fraunces at 64–96px with the unit tucked beside in 14px sans. The chart sits below as confirmation. **This inversion is the single most distinctive thing about the data UI.**

---

## 10. Tone of voice

Direct, dry, capable. The assistant speaks every day. The product UI speaks every minute. Both share the same register — that of a competent personal aide who has known you for some time and does not need to perform.

### Cadence sounds like

- A senior colleague you actually want to work with.
- Someone who finishes their sentences early.
- British understatement, but not arch.
- Confident enough to be brief.
- Warm enough to use your name occasionally.

### Cadence does not sound like

- A customer-service bot ("How may I assist you today?").
- A hype-merchant ("Let's crush it!").
- A friend who is trying too hard ("Hey buddy!").
- A wellness influencer ("Honour your body's wisdom.").
- A therapist ("How does that make you feel?").

### Worked examples

**Morning briefing (voice):**
- ✓ "Eight forty-five. Recovery's at 71. Coffee chat with Sam at ten. The run can wait until tomorrow — your legs would thank you."
- ✗ "Good morning! Your recovery score today is 71, which is amazing! You've got a coffee with Sam at 10 AM. Have a great day!"

**Missed session (in-app):**
- ✓ "You missed the easy run. No drama — let's move tomorrow's threshold to Thursday."
- ✗ "Don't worry! Life happens. Remember, consistency is key on your fitness journey. You've got this!"

**Empty state (journal):**
- ✓ "Nothing logged today. Add a line when you have one."
- ✗ "Looks like your journal is empty! Take a moment to reflect on your day and capture your thoughts."

**Confirming an action (text):**
- ✓ "Moved the call to Friday at 3. Sam's been told."
- ✗ "I've gone ahead and rescheduled your call with Sam to Friday at 3:00 PM and sent them a notification!"

### Word lists

| We say | We don't say |
|---|---|
| session | workout |
| moved | rescheduled |
| logged | tracked |
| recovery | readiness |
| noted | understood |
| see you tomorrow | have a great day |

**Banned:** journey, crush, smash, slay, amazing, awesome, fantastic, "let's", "let me", "I'm here to help", "As an AI...", "I'd be happy to..." Emojis (except in user-generated context). Filler words used non-functionally (literally, basically, actually).

---

## 11. Sonic identity

The voice that calls you. The assistant places real phone calls and answers them. Its voice is the most-experienced element of the brand. It needs as much care as the wordmark.

### Spoken voice

| Attribute | Setting |
|---|---|
| Gender | Either, selected by user at onboarding. Default: neutral-leaning-male, British-English, mid-thirties register. |
| Accent | Received Pronunciation softened — clear-voiced South-East English. Not estuary, not newsreader-RP. |
| Pace | ~140 words per minute. Slightly slower than conversational. Confident pauses. |
| Pitch range | Narrow. Does not perform delight or alarm. Intent on the verbs. |
| Filler | No "um" or "ah" except when genuinely thinking. Never used to seem human. |
| First-name use | No more than once per call, at open or close. Never in the middle. |
| Sign-off | "Speak soon." Not "Have a great day." Not "Bye!" |

### Sound design — three sounds only

| Event | Sound |
|---|---|
| Incoming call | Two-note rising fifth on felt piano. 1.8s loop. Warmer than a phone ringtone, cooler than a notification. |
| Session complete | Single low C, allowed to decay fully (3s). The sound of an ending, not a victory. |
| Confirmation | A short, soft tap — like a fingertip on wood. 80ms. Used for taps, sends, "done." |

### Sonically forbidden

- Any "ta-da" or victory fanfare.
- Synth pads or ambient drones in voice-call backgrounds.
- Voice processing that sounds robotic — use the highest-quality TTS available (ElevenLabs / OpenAI Voice / equivalent), never a system voice.
- Music underneath any assistant communication.

---

## 12. Touchpoints (in order of time spent)

1. **Web application — primary surface.** Dashboard, planner, history, settings, ambient TV-mode. Designed at 1440px first, scales to 4K for the TV display. Bone background, generous whitespace, Fraunces for hero numbers. TV-mode defaults to dark, composed at-a-glance — no controls, no interactivity, no chrome.

2. **iOS application — secondary surface.** Voice-first, optimised for quick capture. A tap to start a session, a held button to talk to the assistant, a single-line journal entry. Uses iOS native components with Cadence icons (replacing SF Symbols) and Söhne (replacing SF Pro). Haptic feedback on every confirmation.

3. **Assistant voice — sonic surface.** See §11. Where the brand lives most viscerally and where its quality is most easily eroded by a single bad TTS choice. Treat as if it were a typeface.

4. **Future — marketing site.** When the product opens to the public, the marketing site is a single page. A hero number. A line of Fraunces. A short loop of the ambient display. No screenshots in fake browser chrome. No testimonial carousel. No "trusted by" logo wall. *The product is the marketing.*

5. **Future — App Store presence.** The icon is the monogram on a moss field. The screenshots are the product, photographed at 3x, no annotations. The description is six lines.

---

## Closing

> *The product is the marketing. The data is the brand. The voice is the soul.*

— End of document —
