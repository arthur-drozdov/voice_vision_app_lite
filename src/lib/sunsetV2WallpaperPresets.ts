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
    glassColor: "28 30% 12%",
    accentColor: { primary: "32 72% 55%", secondary: "35 25% 28%", input: "30 22% 26%", border: "28 20% 18%" },
    greetingGradient: { start: "38 78% 72%", mid: "18 65% 62%", end: "350 40% 60%" },
    bubbleColors: { aiStart: "25 25% 14%", aiEnd: "22 20% 17%", userStart: "30 60% 40%", userEnd: "20 50% 35%" },
    base: "linear-gradient(180deg, hsl(28,30%,12%) 0%, hsl(25,35%,15%) 50%, hsl(30,25%,10%) 100%)",
    layers: [],
  },

  // ── 02  Wildflower Path (Monet) ─────────────────────────────────────────────
  {
    id: "wildflower-path",
    name: "Wildflower Path",
    backgroundImage: "/backgrounds/sunset-v2-wildflower-path.png",
    glassColor: "12 28% 13%",
    accentColor: { primary: "15 65% 58%", secondary: "350 25% 32%", input: "355 20% 28%", border: "345 18% 20%" },
    greetingGradient: { start: "18 70% 72%", mid: "8 60% 65%", end: "340 45% 62%" },
    bubbleColors: { aiStart: "345 22% 14%", aiEnd: "340 18% 17%", userStart: "12 55% 42%", userEnd: "355 45% 38%" },
    base: "linear-gradient(180deg, hsl(12,28%,13%) 0%, hsl(350,25%,16%) 50%, hsl(15,22%,10%) 100%)",
    layers: [],
  },

  // ── 03  Romantic Dusk (Classical) ───────────────────────────────────────────
  {
    id: "romantic-dusk",
    name: "Romantic Dusk",
    backgroundImage: "/backgrounds/sunset-v2-romantic-dusk.png",
    glassColor: "25 32% 10%",
    accentColor: { primary: "38 80% 52%", secondary: "28 30% 26%", input: "25 25% 24%", border: "22 20% 16%" },
    greetingGradient: { start: "42 82% 68%", mid: "28 72% 55%", end: "12 55% 48%" },
    bubbleColors: { aiStart: "22 28% 11%", aiEnd: "20 22% 14%", userStart: "35 65% 38%", userEnd: "25 55% 32%" },
    base: "linear-gradient(180deg, hsl(25,32%,10%) 0%, hsl(22,35%,14%) 50%, hsl(28,28%,8%) 100%)",
    layers: [],
  },

  // ── 04  Dreamtime Sun (Aboriginal) ─────────────────────────────────────────
  {
    id: "dreamtime-sun",
    name: "Dreamtime Sun",
    backgroundImage: "/backgrounds/sunset-v2-dreamtime-sun.png",
    glassColor: "5 35% 11%",
    accentColor: { primary: "30 78% 52%", secondary: "10 35% 28%", input: "8 28% 25%", border: "5 24% 16%" },
    greetingGradient: { start: "40 85% 65%", mid: "22 72% 52%", end: "355 50% 48%" },
    bubbleColors: { aiStart: "5 30% 12%", aiEnd: "358 25% 15%", userStart: "25 65% 40%", userEnd: "8 55% 35%" },
    base: "linear-gradient(180deg, hsl(5,35%,11%) 0%, hsl(10,38%,14%) 50%, hsl(355,30%,8%) 100%)",
    layers: [],
  },

  // ── 05  Cubist Dusk (Cubist) ────────────────────────────────────────────────
  {
    id: "cubist-dusk",
    name: "Cubist Dusk",
    backgroundImage: "/backgrounds/sunset-v2-cubist-dusk.png",
    glassColor: "140 12% 12%",
    accentColor: { primary: "18 48% 55%", secondary: "140 15% 28%", input: "140 12% 25%", border: "142 10% 18%" },
    greetingGradient: { start: "22 55% 68%", mid: "10 42% 58%", end: "140 25% 52%" },
    bubbleColors: { aiStart: "140 15% 13%", aiEnd: "145 12% 16%", userStart: "15 42% 40%", userEnd: "140 22% 32%" },
    base: "linear-gradient(180deg, hsl(140,12%,12%) 0%, hsl(145,10%,14%) 50%, hsl(140,8%,9%) 100%)",
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
