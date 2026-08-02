# Lumen Ecosystem Design System

> Shared visual language for **Lumen**, **Badger Dashboard**, and **Badger CLI**.  
> Source of truth lives in the Lumen site (`styles/design-tokens.json`, `app/globals.css`).  
> Copy this file into Badger repos and implement against it — keep products distinct, keep the *feel* unified.

**Theme:** Midnight command center · coral neon accent  
**Vibe:** Dark, austere, engineered — 98% achromatic, coral only as brand punctuation.

---

## 1. Brand principles (all surfaces)

1. **Void canvas** — nearly black `#040506`. Never a light or gray page background.
2. **One accent** — Coral Pulse `#ff6363`. Logo, focus rings, active tunnel, success-of-brand moments. Not every button.
3. **Neutral CTAs** — primary actions are Mist fill + Iron text, not chromatic.
4. **Hairline + key shadows** — elevation from inset highlights and 1px rings, not soft drop-shadows.
5. **Inter + Geist Mono** — UI in Inter; meta, versions, IDs, CLI in Geist Mono.
6. **Quiet type** — large headlines at weight 400–600; size does the work, not bold shouting.

---

## 2. Color tokens

| Token | Hex | CSS var | Role |
|-------|-----|---------|------|
| Void Black | `#040506` | `--void-black` | Canvas / terminal bg |
| Ink | `#07080a` | `--ink` | Cards, panels, sidebars |
| Obsidian | `#111214` | `--obsidian` | Recessed wells, inputs, pressed |
| Graphite | `#1b1c1e` | `--graphite` | Badges, quiet chips |
| Smoke | `#6a6b6c` | `--smoke` | Secondary body / muted |
| Ash | `#9c9c9d` | `--ash` | Labels, captions, nav idle |
| Mist | `#e6e6e6` | `--mist` | Primary button fill |
| Iron | `#454647` | `--iron` | Text on Mist buttons; mid borders |
| Slate | `#2f3031` | `--slate` | Ghost borders, dark controls |
| Pure White | `#ffffff` | `--pure-white` | Headings, high emphasis |
| Coral Pulse | `#ff6363` | `--coral-pulse` | Brand accent |
| Ember Hush | `#452324` | `--ember-hush` | Warm tinted surfaces |
| Electric Sky | `#63a1ff` | `--electric-sky` | Atmosphere only (hero / splash) |
| Cobalt Edge | `#143ca3` | `--cobalt-edge` | Atmosphere only |
| Deep Space | `#02193b` | `--deep-space` | Atmosphere only |
| Info Blue | `#56c2ff` | `--info-blue` | Soft info wash (not primary CTA) |
| Success Green | `#59d499` | `--success-green` | Soft success wash / healthy status |

### Semantic aliases (use these in Badger)

| Alias | Maps to | Use |
|-------|---------|-----|
| `--canvas` | void-black | Page / app shell |
| `--surface` | ink | Cards, drawer, modal |
| `--recessed` | obsidian | Inputs, code wells |
| `--border` | slate / graphite hairline | Dividers |
| `--text` | pure-white | Primary text |
| `--text-muted` | smoke | Secondary |
| `--text-subtle` | ash | Tertiary / meta |
| `--accent` | coral-pulse | Brand / active |
| `--accent-tint` | ember-hush | Selected row tint |
| `--action` | mist | Primary button bg |
| `--action-fg` | iron | Primary button text |
| `--ok` | success-green | Connected / healthy |
| `--info` | info-blue | Informational |

### Status mapping (Badger-specific)

| State | Color | Notes |
|-------|-------|-------|
| Connected / healthy | `#59d499` | Soft, not neon |
| Connecting / sync | `#56c2ff` or ash pulse | Prefer quiet motion |
| Error / failed | `#ff6363` | Coral doubles as danger in this system |
| Idle / offline | `#6a6b6c` | Smoke |
| Warning | `#ff8f8f` (coral light) or ash + coral left border | Avoid inventing yellow unless needed |

---

## 3. Typography

### Families

| Role | Family | CSS | Fallback |
|------|--------|-----|----------|
| UI / dashboard | **Inter** | `--font-sans` | `ui-sans-serif, system-ui, sans-serif` |
| Meta / CLI / IDs | **Geist Mono** | `--font-mono` | `'JetBrains Mono', Menlo, Monaco, monospace` |

**Weights:** Inter 400 · 500 · 600 · Geist Mono 300 · 400 · 500

### Scale

| Role | Size | Weight | Tracking | Notes |
|------|------|--------|----------|-------|
| Eyebrow | 10–11px | 400 mono | 0.05em | Uppercase, ash |
| Caption | 12px | 400 | — | Mono for versions |
| Label / nav | 13–14px | 500 | 0.01em | Ash idle → white hover |
| Body | 16px | 400 | — | Smoke or white |
| Subhead | 18–20px | 400–500 | 0.01em | |
| Heading | 24–32px | 500–600 | — | |
| Display | 48–64px | 400–600 | slight + | Dashboard splash only |

### Eyebrow utility (copy)

```css
.text-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ash);
}
```

---

## 4. Shape, space, elevation

| Token | Value |
|-------|-------|
| Base unit | `8px` |
| Button / input radius | `8px` |
| Badge radius | `6px` |
| Card radius | `16px` |
| Large panel | `20px` |
| Pill / island nav | `9999px` |
| Card padding | `24px` |
| Control padding | `8px 12px` |
| Section gap | `48–80px` (dash denser than marketing) |

### Shadows (implement exactly)

```css
--shadow-key:
  rgba(0, 0, 0, 0.4) 0px 1.5px 0.5px 2.5px,
  rgb(0, 0, 0) 0px 0px 0.5px 1px,
  rgba(0, 0, 0, 0.25) 0px 2px 1px 1px inset,
  rgba(255, 255, 255, 0.2) 0px 1px 1px 1px inset;

--shadow-hairline:
  rgb(27, 28, 30) 0px 0px 0px 1px,
  rgb(7, 8, 10) 0px 0px 0px 1px inset;

--shadow-glass:
  rgba(0, 0, 0, 0.4) 0px 4px 40px 8px,
  rgba(0, 0, 0, 0.8) 0px 0px 0px 0.5px,
  rgba(255, 255, 255, 0.3) 0px 0.5px 0px 0px inset;
```

---

## 5. Drop-in CSS (dashboard / web)

Paste into Badger dashboard `globals.css` (or equivalent). Load **Inter** + **Geist Mono** the same way as Lumen.

```css
:root {
  --void-black: #040506;
  --ink: #07080a;
  --obsidian: #111214;
  --graphite: #1b1c1e;
  --smoke: #6a6b6c;
  --ash: #9c9c9d;
  --mist: #e6e6e6;
  --iron: #454647;
  --slate: #2f3031;
  --pure-white: #ffffff;
  --coral-pulse: #ff6363;
  --ember-hush: #452324;
  --electric-sky: #63a1ff;
  --cobalt-edge: #143ca3;
  --deep-space: #02193b;
  --info-blue: #56c2ff;
  --success-green: #59d499;

  --canvas: var(--void-black);
  --surface: var(--ink);
  --recessed: var(--obsidian);
  --accent: var(--coral-pulse);
  --accent-tint: var(--ember-hush);
  --text: var(--pure-white);
  --text-muted: var(--smoke);
  --text-subtle: var(--ash);
  --action: var(--mist);
  --action-fg: var(--iron);
  --ok: var(--success-green);
  --info: var(--info-blue);
  --danger: var(--coral-pulse);

  --shadow-key:
    rgba(0, 0, 0, 0.4) 0px 1.5px 0.5px 2.5px,
    rgb(0, 0, 0) 0px 0px 0.5px 1px,
    rgba(0, 0, 0, 0.25) 0px 2px 1px 1px inset,
    rgba(255, 255, 255, 0.2) 0px 1px 1px 1px inset;
  --shadow-hairline:
    rgb(27, 28, 30) 0px 0px 0px 1px,
    rgb(7, 8, 10) 0px 0px 0px 1px inset;
  --shadow-glass:
    rgba(0, 0, 0, 0.4) 0px 4px 40px 8px,
    rgba(0, 0, 0, 0.8) 0px 0px 0px 0.5px,
    rgba(255, 255, 255, 0.3) 0px 0.5px 0px 0px inset;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;
}

body {
  background: var(--canvas);
  color: var(--text);
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.5;
}

::selection {
  background: color-mix(in oklab, var(--coral-pulse) 40%, transparent);
  color: var(--pure-white);
}

/* Surfaces */
.surface-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-hairline);
}

.surface-key {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-key);
}

.glass {
  background: rgba(7, 8, 10, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow-glass);
}

/* Buttons */
.btn-primary {
  background: var(--action);
  color: var(--action-fg);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  border: none;
}

.btn-ghost {
  background: transparent;
  color: var(--ash);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--slate);
}

.btn-ghost:hover {
  color: var(--pure-white);
}

.btn-accent {
  /* Sparse — auth, “create tunnel”, brand moments only */
  background: var(--coral-pulse);
  color: var(--pure-white);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  border: none;
}

/* Inputs */
.input {
  background: rgba(255, 255, 255, 0.05);
  color: var(--pure-white);
  border: none;
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 16px;
  box-shadow: var(--shadow-hairline);
}

.input::placeholder {
  color: var(--ash);
}

.input:focus {
  outline: 1px solid color-mix(in oklab, var(--coral-pulse) 55%, transparent);
  outline-offset: 0;
}

/* Badge */
.badge {
  background: var(--graphite);
  color: var(--pure-white);
  border-radius: var(--radius-sm);
  padding: 0 6px;
  font-size: 12px;
  font-family: var(--font-mono);
}

/* Active / selected row (tunnels list, etc.) */
.row-active {
  background: color-mix(in oklab, var(--ember-hush) 55%, var(--ink));
  box-shadow: inset 2px 0 0 var(--coral-pulse);
}
```

### Optional Tailwind v4 `@theme` bridge

```css
@theme inline {
  --color-void-black: var(--void-black);
  --color-ink: var(--ink);
  --color-obsidian: var(--obsidian);
  --color-graphite: var(--graphite);
  --color-smoke: var(--smoke);
  --color-ash: var(--ash);
  --color-mist: var(--mist);
  --color-iron: var(--iron);
  --color-slate: var(--slate);
  --color-pure-white: var(--pure-white);
  --color-coral-pulse: var(--coral-pulse);
  --color-ember-hush: var(--ember-hush);
  --color-info-blue: var(--info-blue);
  --color-success-green: var(--success-green);
  --font-sans: var(--font-inter);
  --font-mono: var(--font-geist-mono);
}
```

---

## 6. Badger Dashboard — apply this way

| Surface | Treatment |
|---------|-----------|
| App shell | `--canvas` full bleed |
| Sidebar | `--ink` + hairline right edge |
| Top bar | `.glass` island or full-width hairline strip |
| Tunnel / workspace cards | `.surface-card` or `.surface-key` |
| Tables | white/ash text; active row = `.row-active` |
| Code / public URL | Geist Mono 12–13px, ash or white |
| Empty states | Quiet Inter copy + one Mist CTA |
| Auth screens | Same tokens; optional coral diamond / mark only |

**Density:** slightly tighter than the Lumen marketing site (more 8/16 gaps, fewer 80–120 section gaps). Same colors and fonts.

---

## 7. Badger CLI — terminal theme

CLI cannot load Inter/Geist as fonts in every terminal. Map the *palette* and *rhythm* instead:

### ANSI / chalk palette

| Role | Hex | Suggested chalk / ANSI |
|------|-----|------------------------|
| Brand / error / focus | `#ff6363` | `chalk.hex('#ff6363')` or bright red |
| Success / connected | `#59d499` | `chalk.hex('#59d499')` or green |
| Info | `#56c2ff` | `chalk.hex('#56c2ff')` or cyan |
| Muted | `#6a6b6c` | `chalk.hex('#6a6b6c')` or dim |
| Label | `#9c9c9d` | `chalk.hex('#9c9c9d')` |
| Primary text | `#e6e6e6` / `#ffffff` | white |
| Heading / command | `#ffffff` | bold white |
| Border / box | `#2f3031` | `chalk.hex('#2f3031')` |

### Example token module (TypeScript)

```ts
export const lumen = {
  coral: "#ff6363",
  ember: "#452324",
  white: "#ffffff",
  mist: "#e6e6e6",
  ash: "#9c9c9d",
  smoke: "#6a6b6c",
  slate: "#2f3031",
  ink: "#07080a",
  void: "#040506",
  ok: "#59d499",
  info: "#56c2ff",
} as const;

export const cli = {
  brand: (s: string) => chalk.hex(lumen.coral)(s),
  ok: (s: string) => chalk.hex(lumen.ok)(s),
  info: (s: string) => chalk.hex(lumen.info)(s),
  muted: (s: string) => chalk.hex(lumen.smoke)(s),
  label: (s: string) => chalk.hex(lumen.ash)(s),
  text: (s: string) => chalk.hex(lumen.mist)(s),
  strong: (s: string) => chalk.bold.hex(lumen.white)(s),
  err: (s: string) => chalk.hex(lumen.coral)(s),
};
```

### CLI UX rules

1. **Prefix** product lines with a coral mark, e.g. `◆ badger` or `badger ›`.
2. **Tables / lists** — ash headers, mist values, coral only on active tunnel name.
3. **Boxes** — single-line borders in slate; no rainbow frames.
4. **Spinners** — ash or coral, not blue rainbows.
5. **Help text** — smoke; commands in bold white; flags in ash.
6. **Errors** — coral text; no yellow-unless-necessary.
7. Prefer **truecolor** (`chalk.hex`) when available; fall back to ANSI 16 with coral→red, ok→green, info→cyan, muted→dim.

### Sample output tone

```
◆ badger  tunnel list

  NAME          STATUS       URL
  api-prod      connected    https://api-prod.badger.dev
  staging       idle         —

  2 tunnels · workspace acme
```

(`◆` / status “connected” in coral/green; headers ash; URLs mist.)

---

## 8. Component recipes (shared)

| Pattern | Spec |
|---------|------|
| Primary button | Mist bg, Iron text, 8px radius, 13px/500 |
| Ghost button | Transparent, slate border, ash → white hover |
| Accent button | Coral — rare (create, upgrade, brand) |
| Input | Recessed white 5% fill, 8px radius, coral focus ring |
| Badge | Graphite, 6px radius, mono 12px |
| Nav link | Ash 13–14px → white hover |
| Glass chrome | `.glass` blur island (nav / floating panels) |
| Selected item | Ember hush wash + 2px coral left edge |

---

## 9. Do / Don’t

### Do
- Use `#040506` as the only canvas
- Keep coral scarce and intentional
- Use Mist/Iron for everyday primary actions
- Use Geist Mono for IDs, versions, URLs, CLI-like UI
- Match Lumen token names when possible (`coral-pulse`, `void-black`, …)

### Don’t
- Don’t invent a second brand purple/blue primary
- Don’t use chromatic CTAs everywhere
- Don’t light-mode the dashboard “for readability” — raise contrast with ash/white on void instead
- Don’t use heavy drop shadows or colorful glows on paths/cards
- Don’t mix Inter with another UI sans in Badger

---

## 10. Implementation checklist

### Dashboard
- [ ] Install Inter + Geist Mono
- [ ] Paste `:root` tokens from §5
- [ ] Restyle shell, sidebar, cards, buttons, inputs
- [ ] Map tunnel status colors to §2 status table
- [ ] Selected/active rows use ember + coral edge

### CLI
- [x] Add `lumen` color module from §7
- [x] Restyle help, tables, spinners, errors
- [x] Brand prefix in coral
- [x] Truecolor with ANSI fallback
- [x] Animations — coral pulse / dig / shimmer (ash field, no rainbow)

### Sync
- [ ] Keep this file + `styles/design-tokens.json` in sync when Lumen tokens change
- [ ] Prefer copying tokens — don’t fork hex values casually

---

## 11. File references (Lumen)

| File | What |
|------|------|
| `styles/design-tokens.json` | DTCG color + font tokens |
| `app/globals.css` | Live CSS vars, shadows, utilities |
| `.cursor/rules/design-language.mdc` | Short visual rules |
| `.cursor/rules/design.mdc` | Full style reference |
| **This file** | Cross-product (Badger dash + CLI) implementation guide |

---

*Ecosystem: Lumen (site) · Badger (dashboard + CLI) — one palette, one type system, product-specific density and layout.*
