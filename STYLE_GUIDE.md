# Voice Vision — Global Style Guide

> **These are the design laws of the app.** Every theme, sub-theme, and future feature must follow these rules. When building a new theme, you only adjust colours, backgrounds, and graphics — the structural rules stay constant.

---

## 1. Architecture Overview

The app uses a **layered theming system**:

```
┌─────────────────────────────────┐
│  CSS Variables  (:root)         │  ← base tokens, overridden per theme
├─────────────────────────────────┤
│  WallpaperPreset (sub-theme)    │  ← runtime overrides via JS
├─────────────────────────────────┤
│  Components (Glass, Bubbles…)   │  ← consume variables, never hardcode
└─────────────────────────────────┘
```

**Golden rule:** Components must NEVER use hardcoded colour values. Always reference CSS variables.

---

## 2. CSS Variable Token System

Every sub-theme must define or override these tokens. All values are **HSL without `hsl()` wrapper** (e.g., `"210 65% 55%"`).

### Core Tokens (set in `:root`, overridden by `WallpaperPreset.accentColor`)

| Variable | Purpose | Example |
|---|---|---|
| `--background` | Page background (very dark) | `175 40% 6%` |
| `--foreground` | Primary text colour | `0 0% 96%` |
| `--primary` | Switches ON, buttons, active accents | `185 60% 50%` |
| `--secondary` | Slider tracks, muted cards | `180 20% 65%` |
| `--border` | Card/section borders | `180 40% 22%` |
| `--input` | Switch OFF state, form inputs | `180 25% 60%` |
| `--ring` | Focus ring (= primary) | `185 60% 50%` |
| `--muted` | Muted background | `172 25% 18%` |
| `--muted-foreground` | Muted/secondary text | `0 0% 88%` |

### Surface Tokens (set by `WallpaperPreset.glassColor`)

| Variable | Purpose | Example |
|---|---|---|
| `--surface-glass` | Glass panel tint colour | `172 55% 20%` |
| `--popover` | Dropdown panel background (= glassColor) | `172 55% 20%` |
| `--card` | Card background (= glassColor) | `172 55% 20%` |

### Greeting Tokens (set by `WallpaperPreset.greetingGradient`)

| Variable | Purpose | Example |
|---|---|---|
| `--greeting-start` | Gradient start | `195 80% 80%` |
| `--greeting-mid` | Gradient middle | `210 65% 70%` |
| `--greeting-end` | Gradient end | `172 60% 65%` |

### Chat Bubble Tokens (set by `WallpaperPreset.bubbleColors`)

| Variable | Purpose | Example |
|---|---|---|
| `--bubble-ai-start` | AI bubble gradient start | `240 30% 32%` |
| `--bubble-ai-end` | AI bubble gradient end | `220 35% 40%` |
| `--bubble-user-start` | User bubble gradient start | `195 55% 38%` |
| `--bubble-user-end` | User bubble gradient end | `172 50% 45%` |

### Glow Tokens

| Variable | Purpose |
|---|---|
| `--glow-primary` | Primary glow colour (= primary) |
| `--glow-accent` | Accent glow colour |

---

## 3. WallpaperPreset Interface

Every sub-theme is defined as a `WallpaperPreset` in `wallpaperPresets.ts`. All fields:

```typescript
{
  id: string;              // Unique ID (kebab-case)
  name: string;            // Display name
  base: string;            // CSS gradient for the base background layer
  layers?: [{              // Animated glow orbs (2-3 recommended)
    bg: string;            //   radial-gradient CSS
    blur?: number;         //   blur radius in px (20-30)
    animation?: string;    //   CSS animation name + timing
  }];
  glassColor: string;      // HSL for --surface-glass, --popover, --card
  accentColor: {
    primary: string;       // Switches ON, buttons, active states
    secondary: string;     // Muted UI elements
    input: string;         // Form input backgrounds
    border: string;        // Section/card borders
  };
  greetingGradient: {
    start: string;         // MUST contrast with glassColor
    mid: string;           // Creates shimmer sweep
    end: string;           // Loops back to start
  };
  bubbleColors: {
    aiStart: string;       // MUST contrast with background
    aiEnd: string;         // Different hue from user bubbles
    userStart: string;     // MUST contrast with background
    userEnd: string;       // Different hue from AI bubbles
  };
}
```

---

## 4. Glass Effects — The Laws

### `.glass` utility class (CSS)
- `backdrop-filter: blur(12px) saturate(1.3)`
- `background: hsl(var(--surface-glass) / 0.65)`
- `border: 1px solid rgba(255, 255, 255, 0.18)`
- `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12)`

### `GlassContainer` component (two variants)

| Property | Dark (default) | Bright |
|---|---|---|
| Background | `--surface-glass / 0.45` | `--surface-glass / 0.25` |
| Blur | 6px | 6px |
| Border radius | 10px | 8px |
| Border | `--border / 0.15` | `--border / 0.20` |
| Shadow | `0 6px 18px rgba(0,0,0,0.15)` | `0 4px 12px rgba(0,0,0,0.10)` |
| Use case | Headers, panels, cards | Chat header agent display |

### Rules
1. **Never use `rgba(10,12,15,...)` or any hardcoded colour** for glass backgrounds
2. Always use `--surface-glass` with varying opacity
3. Glass borders use `--border` at low opacity (0.15–0.20)
4. Glass must always have `backdrop-filter: blur()` for the frosted effect

---

## 5. Chat Bubbles — The Laws

### AI Bubbles
```css
background: linear-gradient(135deg,
  hsl(var(--bubble-ai-start) / 0.55) 0%,
  hsl(var(--bubble-ai-end) / 0.65) 100%
);
```

### User Bubbles
```css
background: linear-gradient(135deg,
  hsl(var(--bubble-user-start) / 0.55) 0%,
  hsl(var(--bubble-user-end) / 0.65) 100%
);
```

### Rules
1. **AI and User bubbles must use DIFFERENT hue families** — never the same
2. **Bubbles must CONTRAST with the background** — don't use background colours
3. Opacity 0.55→0.65 gradient (lighter start, slightly denser end)
4. Both have `backdrop-filter: blur(8px) saturate(1.2)`
5. Both have `border: 1px solid rgba(255,255,255,0.10)`
6. Both use `color: white` for text
7. **In Focus mode**: bubbles remain themed (no override needed)

### Colour Strategy Per Background

| Background Hue | AI Bubble Hues | User Bubble Hues |
|---|---|---|
| Teal/Green | Purple/Indigo (250–280°) | Teal/Cyan (168–195°) |
| Blue/Navy | Warm Purple (240–260°) | Cool Teal (195–210°) |
| Purple/Violet | Blue-Slate (210–250°) | Magenta/Rose (270–310°) |
| Pink/Rose | Slate-Purple (240–260°) | Coral/Rose (320–340°) |
| Mixed/Iridescent | Blue-Slate (210–250°) | Purple-Magenta (270–310°) |

---

## 6. Typography — The Laws

### Font
- **Family**: `'Poppins', system-ui, -apple-system, sans-serif`
- **Base size**: `calc(var(--base-font-size) * var(--text-scale))`

### Text Colours
| Use case | Class / Variable |
|---|---|
| Primary text | `text-foreground` |
| Secondary/muted text | `text-muted-foreground` |
| Active/accent text | `text-primary` |
| White (on coloured bg) | `text-white` or `hsl(0, 0%, 100%)` |

### Greeting Shimmer
- Uses `greeting-shimmer` class
- 3-colour gradient: `--greeting-start` → `--greeting-mid` → `--greeting-end`
- `background-size: 300% 100%` with `greeting-sparkle` animation (4s loop)
- **Focus mode override**: plain white, no animation

### Rules
1. **Never hardcode text colours** — always use CSS variables
2. Greeting colours must be LIGHTER than the background (high lightness ≥65%)
3. Greeting colours should complement but not match the background palette

---

## 7. Layout — The Laws

### Page Structure
```
┌──────────────────────────────────┐
│ Header (pt-12 pb-2/3)           │  ← GlassContainer "dark" sm
│   Title + Subtitle + Actions    │
├──────────────────────────────────┤
│ Content (flex-1 overflow-y-auto) │  ← Scrollable area
│   Cards, sections, etc.         │
├──────────────────────────────────┤
│ Footer / Input (if any)         │  ← pb-20 to clear BottomNav
├──────────────────────────────────┤
│ BottomNav (fixed, 64px)         │  ← Absolute positioned
└──────────────────────────────────┘
```

### Spacing
| Element | Padding |
|---|---|
| Page horizontal | `px-5` or `px-6` |
| Page top | `pt-12` |
| Card sections gap | `space-y-6` |
| Card content internal | `px-4 py-3` (GlassContainer md) |
| Bottom (input areas) | `pb-20` (clears 64px BottomNav + room) |
| Bottom (scroll areas) | `pb-4` |

### Rules
1. **Every page uses `flex flex-col h-full`** as root container
2. Scrollable content areas use `flex-1 overflow-y-auto`
3. Input areas at bottom MUST have `pb-20` to clear the BottomNav
4. BottomNav is absolutely positioned — content must account for its height
5. **No footer action bars at bottom** — settings/actions go inline in sections

---

## 8. Bottom Navigation — The Laws

### Active State
- White text and icon with primary-coloured neon glow
- `text-shadow` with `--primary` layered shadows
- Icon `filter: drop-shadow()`
- `font-semibold` weight

### Inactive State  
- `text-muted-foreground` colour
- No glow effects

---

## 9. Dropdowns & Popovers — The Laws

### Dropdown Panel
- Background: `hsl(var(--surface-glass) / 0.95)` with `blur(20px)`
- **No border** (`border-0`)
- Items separated by subtle `border-b border-border/20`

### Dropdown Items
- Hover: `bg-primary/20`
- Selected checkmark: `text-primary`
- Highlighted: `bg-primary/20` (via CSS `[role="option"][data-highlighted]`)

### Rules
1. Dropdown/popover backgrounds ALWAYS use `--surface-glass`
2. Hover/focus states ALWAYS use `--primary` at 15–20% opacity
3. **Never use `bg-popover` Tailwind class** — use inline style with variable

---

## 10. Interactive Elements — The Laws

### Switches (Toggle)

The toggle has two parts: the **track** (pill-shaped background) and the **thumb** (circular knob). The thumb MUST be a real `<span>` or `<div>` element, NOT a CSS pseudo-element.

**OFF state:**
- Track: muted `--input` colour at 35% opacity
- Thumb: visible, primary-coloured circle, positioned on the left (`translateX(0)`)
- Shadow on thumb: `0 1px 3px rgba(0,0,0,0.3)`

**ON state:**
- Track: solid `--primary` at 80% opacity
- Thumb: **invisible** (`opacity: 0`) — entire switch is one clean solid primary pill
- No thumb shadow

**Animation:**
- Thumb slides via `transform: translateX()` — `transition: transform 250ms ease`
- Thumb fades via `opacity` — `transition: opacity 200ms ease`
- Track colour changes via `transition: background-color 250ms ease`

**Rules:**
1. Thumb colour is ALWAYS `--primary` (it just fades invisible when ON)
2. Track ON colour is ALWAYS `--primary / 0.80`
3. Track OFF colour is ALWAYS `--input / 0.35`
4. Do NOT use Radix `SwitchPrimitives.Thumb` — it overrides styles. Use a plain `<span>`

### Buttons (Primary Actions)
- Background: `hsl(var(--primary))`
- Text: white
- Glow on active: `box-shadow: 0 0 14px hsl(var(--primary) / 0.45)`

### Save Status
- Success: green `hsl(142, 72%, 55%)`
- Error: red `hsl(0, 70%, 50%)`
- These are FIXED colours — not themed

---

## 11. Backgrounds — The Laws

### Structure
Each background has 3–4 layers:
1. **Base**: Multi-stop `linear-gradient` (the foundational colours)
2. **Glow Orbs** (2–3): `radial-gradient` circles/ellipses with animation
   - Blur: 20–30px
   - Animations: `theme-marble-drift` variants (11–22s, ease-in-out, infinite)
   - Opacity: 0.30–0.60

### Animation Keyframes
- **`theme-marble-drift`**: translate ±80px, scale 0.85–1.15, rotate ±12° — visible floating movement
- **`theme-sunset-pulse`**: opacity 0.50→1.0, scale 1.0→1.12 — visible breathing/pulsing
- **`theme-blob-float`**: translate ±22px, scale 0.96–1.05 — gentle wobble
- Orb durations should be 11–22s with staggered delays
- Some orbs should use `reverse` animation direction

### Rules
1. Base gradient should have 5–6 colour stops for richness
2. Glow orbs must be positioned at different locations (not all centered)
3. Animations should have staggered durations (not all the same speed)
4. Animation movements must be LARGE ENOUGH to be visible (≥50px translate)
5. Use delays (`5s`, `6s`, etc.) to prevent orbs from syncing

### Focus Mode
- Background switches to `FocusBg` (separate calm background)
- All panels fade via `.focus-mode .page-*` opacity transitions
- Greeting becomes plain white, no animation
- Chat bubbles remain themed

---

## 12. Canvas — The Laws

### Mindmap Branch Nodes
Mindmap branches are **opaque**, NOT glassy. They use solid coloured backgrounds:

```
bg: bg-{colour}/90     (90% opacity — nearly solid)
border: border-{colour}/80
text: appropriate contrast colour (dark text on light bg, white on dark bg)
```

Branch colours cycle through: primary, violet, amber, rose, emerald, sky.

Each branch has a **left accent bar** (2.5px gradient strip) for visual identification.

### Rules
1. **Never use `.glass` class on mindmap nodes** — they must be opaque
2. Branch backgrounds must be at least 90% opacity
3. Text colour must contrast with the branch background
4. The root title node uses `GlassContainer` (exception — it's a header)
5. Other Canvas views (todo, calendar, summary) use `.glass` normally

---

## 13. Theme Creation Checklist

When creating a new sub-theme, provide ALL of these:

- [ ] **`id`** — unique kebab-case identifier
- [ ] **`name`** — human-readable display name
- [ ] **`base`** — 5–6 stop linear gradient
- [ ] **`layers`** — 2–3 animated glow orbs at different positions
- [ ] **`glassColor`** — mid-tone HSL matching the palette (~20% lightness)
- [ ] **`accentColor.primary`** — bright, saturated, the "hero" colour
- [ ] **`accentColor.secondary`** — muted version for tracks/backgrounds
- [ ] **`accentColor.input`** — slightly lighter than secondary
- [ ] **`accentColor.border`** — dark tint of the palette (~30% lightness)
- [ ] **`greetingGradient`** — 3 colours, all light (≥65% lightness), contrasting with glass
- [ ] **`bubbleColors`** — AI and User use DIFFERENT hue families, BOTH contrast with background

### Quality Checks
1. Open each page (Home, Chat, Video, Canvas, Customise) and confirm glass panels are visible
2. Open a chat conversation — AI and User bubbles must be clearly distinguishable
3. Check dropdown menus — hover tint should match primary
4. Toggle focus mode — greeting turns white, panels dim, background switches
5. Check the greeting shimmer animation — colours should flow smoothly
6. Switch ON/OFF toggles — ON state must be clearly brighter/different than OFF

---

## 14. Do NOT

| ❌ Never | ✅ Instead |
|---|---|
| Hardcode `rgba(...)` in components | Use `hsl(var(--variable) / opacity)` |
| Use `bg-popover` Tailwind class | Use inline `hsl(var(--surface-glass) / 0.95)` |
| Make bubble colours match background | Choose contrasting hue families |
| Use same gradient for AI and User | Each gets its own colour pair |
| Skip `greetingGradient` or `bubbleColors` | Always define all preset fields |
| Add footer action bars | Move actions inline into relevant sections |
| Use `pb-4` for areas above BottomNav | Use `pb-20` |
| Animate the greeting in Focus mode | Override to plain white, `animation: none` |
| Use `.glass` on Canvas mindmap nodes | Use opaque `bg-{colour}/90` |
| Use Radix `SwitchPrimitives.Thumb` | Use plain `<span>` with inline styles |
| Make background animations too subtle | Use ≥50px translate, ≥0.15 scale range |
| Show toggle thumb when switch is ON | Thumb fades to `opacity: 0` when ON |
