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
    glassColor: "28 55% 20%",
    accentColor: { primary: "32 72% 55%", secondary: "30 38% 62%", input: "28 35% 55%", border: "28 28% 18%" },
    greetingGradient: { start: "38 78% 72%", mid: "18 65% 62%", end: "350 40% 60%" },
    bubbleColors: { aiStart: "25 40% 18%", aiEnd: "22 35% 20%", userStart: "30 60% 40%", userEnd: "20 50% 35%" },
    base: "linear-gradient(180deg, hsl(28,40%,12%) 0%, hsl(25,45%,15%) 50%, hsl(30,35%,10%) 100%)",
    layers: [],
  },

  // ── 02  Wildflower Path (Monet) ─────────────────────────────────────────────
  {
    id: "wildflower-path",
    name: "Wildflower Path",
    backgroundImage: "/backgrounds/sunset-v2-wildflower-path.png",
    glassColor: "12 52% 18%",
    accentColor: { primary: "15 65% 58%", secondary: "12 38% 65%", input: "10 35% 58%", border: "345 25% 20%" },
    greetingGradient: { start: "18 70% 72%", mid: "8 60% 65%", end: "340 45% 62%" },
    bubbleColors: { aiStart: "345 38% 18%", aiEnd: "340 32% 20%", userStart: "12 55% 42%", userEnd: "355 45% 38%" },
    base: "linear-gradient(180deg, hsl(12,38%,13%) 0%, hsl(350,35%,16%) 50%, hsl(15,30%,10%) 100%)",
    layers: [],
  },

  // ── 03  Romantic Dusk (Classical) ───────────────────────────────────────────
  {
    id: "romantic-dusk",
    name: "Romantic Dusk",
    backgroundImage: "/backgrounds/sunset-v2-romantic-dusk.png",
    glassColor: "25 58% 18%",
    accentColor: { primary: "38 80% 52%", secondary: "32 36% 62%", input: "30 32% 55%", border: "22 30% 16%" },
    greetingGradient: { start: "42 82% 68%", mid: "28 72% 55%", end: "12 55% 48%" },
    bubbleColors: { aiStart: "22 45% 16%", aiEnd: "20 38% 18%", userStart: "35 65% 38%", userEnd: "25 55% 32%" },
    base: "linear-gradient(180deg, hsl(25,42%,10%) 0%, hsl(22,45%,14%) 50%, hsl(28,38%,8%) 100%)",
    layers: [],
  },

  // ── 04  Dreamtime Sun (Aboriginal) ─────────────────────────────────────────
  {
    id: "dreamtime-sun",
    name: "Dreamtime Sun",
    backgroundImage: "/backgrounds/sunset-v2-dreamtime-sun.png",
    glassColor: "5 60% 18%",
    accentColor: { primary: "30 78% 52%", secondary: "15 38% 64%", input: "12 35% 56%", border: "5 35% 16%" },
    greetingGradient: { start: "40 85% 65%", mid: "22 72% 52%", end: "355 50% 48%" },
    bubbleColors: { aiStart: "5 50% 16%", aiEnd: "358 42% 18%", userStart: "25 65% 40%", userEnd: "8 55% 35%" },
    base: "linear-gradient(180deg, hsl(5,45%,11%) 0%, hsl(10,48%,14%) 50%, hsl(355,40%,8%) 100%)",
    layers: [],
  },

  // ── 05  Cubist Dusk (Cubist) ────────────────────────────────────────────────
  {
    id: "cubist-dusk",
    name: "Cubist Dusk",
    backgroundImage: "/backgrounds/sunset-v2-cubist-dusk.png",
    glassColor: "210 50% 20%",
    accentColor: { primary: "200 55% 55%", secondary: "205 22% 64%", input: "208 25% 58%", border: "210 22% 18%" },
    greetingGradient: { start: "195 50% 68%", mid: "210 42% 58%", end: "22 40% 55%" },
    bubbleColors: { aiStart: "210 42% 18%", aiEnd: "215 35% 20%", userStart: "200 45% 42%", userEnd: "210 35% 35%" },
    base: "linear-gradient(180deg, hsl(210,35%,13%) 0%, hsl(215,30%,16%) 50%, hsl(210,25%,9%) 100%)",
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
