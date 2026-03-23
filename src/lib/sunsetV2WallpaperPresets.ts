/**
 * Sunset V2 (Gallery) Theme — Wallpaper Presets
 *
 * 5 image-based wallpapers, each showing the same sunset meadow scene
 * rendered in a different art style:
 *
 * 1. Starry River     — Van Gogh post-impressionist (gentle swirls)
 * 2. Wildflower Path  — Monet impressionist (soft pastels, haze)
 * 3. Romantic Dusk    — 18th-century Romantic oil painting (classical)
 * 4. Dreamtime Sun    — Aboriginal dot-painting (warm earthy)
 * 5. Cubist Dusk      — Cubist geometric (muted, angular)
 *
 * Selection stored in localStorage under "voicevision_bg_sunset-v2".
 */

import type { WallpaperPreset } from "./wallpaperPresets";

const STORAGE_KEY = "voicevision_bg_sunset-v2";

export const sunsetV2WallpaperPresets: WallpaperPreset[] = [
  // ── 01  Starry River (Van Gogh) ─────────────────────────────────────────────
  {
    id: "starry-river",
    name: "Starry River",
    backgroundImage: "/backgrounds/sunset-v2-starry-river.png",
    glassColor: "28 35% 12%",
    accentColor: { primary: "28 85% 55%", secondary: "215 35% 30%", input: "28 30% 28%", border: "28 25% 18%" },
    greetingGradient: { start: "42 85% 70%", mid: "28 80% 62%", end: "215 50% 60%" },
    bubbleColors: { aiStart: "215 30% 14%", aiEnd: "220 25% 18%", userStart: "28 70% 42%", userEnd: "15 60% 38%" },
    base: "linear-gradient(180deg, hsl(215,35%,14%) 0%, hsl(28,60%,18%) 50%, hsl(42,50%,15%) 100%)",
    layers: [],
  },

  // ── 02  Wildflower Path (Monet) ─────────────────────────────────────────────
  {
    id: "wildflower-path",
    name: "Wildflower Path",
    backgroundImage: "/backgrounds/sunset-v2-wildflower-path.png",
    glassColor: "330 22% 14%",
    accentColor: { primary: "330 50% 58%", secondary: "340 30% 35%", input: "335 25% 32%", border: "330 20% 20%" },
    greetingGradient: { start: "340 45% 72%", mid: "28 65% 68%", end: "280 40% 65%" },
    bubbleColors: { aiStart: "330 25% 14%", aiEnd: "335 20% 18%", userStart: "330 45% 42%", userEnd: "340 40% 40%" },
    base: "linear-gradient(180deg, hsl(280,22%,14%) 0%, hsl(340,35%,18%) 40%, hsl(28,50%,18%) 70%, hsl(120,20%,12%) 100%)",
    layers: [],
  },

  // ── 03  Romantic Dusk (Classical) ───────────────────────────────────────────
  {
    id: "romantic-dusk",
    name: "Romantic Dusk",
    backgroundImage: "/backgrounds/sunset-v2-romantic-dusk.png",
    glassColor: "28 30% 10%",
    accentColor: { primary: "38 75% 50%", secondary: "28 35% 30%", input: "30 28% 28%", border: "25 22% 16%" },
    greetingGradient: { start: "42 80% 68%", mid: "28 70% 58%", end: "15 60% 52%" },
    bubbleColors: { aiStart: "25 28% 12%", aiEnd: "28 22% 16%", userStart: "38 65% 40%", userEnd: "28 58% 38%" },
    base: "linear-gradient(180deg, hsl(28,30%,10%) 0%, hsl(25,40%,15%) 40%, hsl(38,50%,18%) 70%, hsl(120,20%,10%) 100%)",
    layers: [],
  },

  // ── 04  Dreamtime Sun (Aboriginal) ─────────────────────────────────────────
  {
    id: "dreamtime-sun",
    name: "Dreamtime Sun",
    backgroundImage: "/backgrounds/sunset-v2-dreamtime-sun.png",
    glassColor: "8 40% 12%",
    accentColor: { primary: "28 80% 52%", secondary: "8 38% 30%", input: "12 32% 28%", border: "5 28% 16%" },
    greetingGradient: { start: "42 88% 68%", mid: "18 75% 55%", end: "350 55% 48%" },
    bubbleColors: { aiStart: "5 32% 12%", aiEnd: "8 28% 16%", userStart: "28 68% 40%", userEnd: "8 60% 36%" },
    base: "linear-gradient(180deg, hsl(350,35%,12%) 0%, hsl(8,45%,16%) 40%, hsl(28,55%,18%) 70%, hsl(42,40%,14%) 100%)",
    layers: [],
  },

  // ── 05  Cubist Dusk (Cubist) ────────────────────────────────────────────────
  {
    id: "cubist-dusk",
    name: "Cubist Dusk",
    backgroundImage: "/backgrounds/sunset-v2-cubist-dusk.png",
    glassColor: "15 25% 12%",
    accentColor: { primary: "15 55% 52%", secondary: "200 20% 32%", input: "18 22% 30%", border: "200 18% 18%" },
    greetingGradient: { start: "28 60% 65%", mid: "15 50% 55%", end: "200 35% 55%" },
    bubbleColors: { aiStart: "200 22% 14%", aiEnd: "195 18% 18%", userStart: "15 50% 40%", userEnd: "28 45% 38%" },
    base: "linear-gradient(180deg, hsl(200,22%,14%) 0%, hsl(15,35%,16%) 45%, hsl(28,40%,16%) 70%, hsl(200,18%,10%) 100%)",
    layers: [],
  },
];

export const DEFAULT_SUNSET_V2_WALLPAPER = "starry-river";

export function getSelectedSunsetV2Wallpaper(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_SUNSET_V2_WALLPAPER;
}

export function setSelectedSunsetV2Wallpaper(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new Event("wallpaperchange"));
}

export function getSunsetV2PresetById(id: string): WallpaperPreset | undefined {
  return sunsetV2WallpaperPresets.find((p) => p.id === id);
}
