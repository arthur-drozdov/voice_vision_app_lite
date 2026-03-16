/**
 * Sunset Theme — Wallpaper Presets (6 presets, Canvas 2D Van Gogh paintings)
 *
 * 1. Starry Dusk     — lake sunset, swirling sky, cypress trees
 * 2. Meadow Path     — purple sunset clouds, wildflower field
 * 3. Wheatfield      — deep blue sky complement, golden wheat
 * 4. Ember Wave      — fire ocean wave, golden crest
 * 5. Canyon Fire     — Antelope Canyon sandstone, light beam
 * 6. Brushfire       — abstract horizontal impasto layers
 *
 * Selection stored in localStorage under "voicevision_bg_sunset".
 */

import type { WallpaperPreset } from "./wallpaperPresets";

const STORAGE_KEY = "voicevision_bg_sunset";

export const sunsetWallpaperPresets: WallpaperPreset[] = [
  // ── 01  Starry Dusk ──────────────────────────────────────────────────────────
  {
    id: "starry-dusk",
    name: "Starry Dusk",
    glassColor: "18 38% 16%",
    accentColor: { primary: "28 90% 58%", secondary: "18 45% 42%", input: "20 35% 38%", border: "18 30% 22%" },
    greetingGradient: { start: "28 85% 72%", mid: "350 70% 65%", end: "42 80% 68%" },
    bubbleColors: { aiStart: "18 32% 16%", aiEnd: "15 28% 20%", userStart: "28 75% 42%", userEnd: "350 65% 40%" },
    base: "linear-gradient(180deg, hsl(280,22%,14%) 0%, hsl(15,50%,18%) 40%, hsl(28,70%,25%) 70%, hsl(15,30%,8%) 100%)",
    layers: [],
  },

  // ── 02  Meadow Path ──────────────────────────────────────────────────────────
  {
    id: "meadow-path",
    name: "Meadow Path",
    glassColor: "280 32% 16%",
    accentColor: { primary: "280 55% 58%", secondary: "275 40% 45%", input: "278 32% 42%", border: "280 28% 22%" },
    greetingGradient: { start: "280 50% 75%", mid: "28 80% 68%", end: "330 60% 70%" },
    bubbleColors: { aiStart: "280 30% 16%", aiEnd: "275 25% 20%", userStart: "280 50% 42%", userEnd: "300 45% 40%" },
    base: "linear-gradient(180deg, hsl(280,30%,14%) 0%, hsl(330,40%,20%) 35%, hsl(28,65%,22%) 65%, hsl(120,30%,12%) 100%)",
    layers: [],
  },

  // ── 03  Wheatfield ───────────────────────────────────────────────────────────
  {
    id: "wheatfield",
    name: "Wheatfield",
    glassColor: "215 40% 16%",
    accentColor: { primary: "215 65% 52%", secondary: "215 45% 42%", input: "215 38% 38%", border: "215 30% 22%" },
    greetingGradient: { start: "215 55% 72%", mid: "42 75% 65%", end: "28 80% 62%" },
    bubbleColors: { aiStart: "215 35% 15%", aiEnd: "220 30% 20%", userStart: "215 60% 40%", userEnd: "225 55% 38%" },
    base: "linear-gradient(180deg, hsl(215,45%,16%) 0%, hsl(215,50%,22%) 30%, hsl(28,70%,22%) 60%, hsl(46,65%,20%) 100%)",
    layers: [],
  },

  // ── 04  Ember Wave ───────────────────────────────────────────────────────────
  {
    id: "ember-wave",
    name: "Ember Wave",
    glassColor: "15 42% 14%",
    accentColor: { primary: "28 88% 55%", secondary: "15 50% 38%", input: "18 40% 34%", border: "12 30% 20%" },
    greetingGradient: { start: "42 90% 72%", mid: "28 85% 62%", end: "350 70% 58%" },
    bubbleColors: { aiStart: "12 35% 14%", aiEnd: "15 30% 18%", userStart: "28 72% 40%", userEnd: "15 65% 38%" },
    base: "linear-gradient(180deg, hsl(15,40%,10%) 0%, hsl(15,55%,18%) 35%, hsl(28,70%,22%) 60%, hsl(12,40%,8%) 100%)",
    layers: [],
  },

  // ── 05  Canyon Fire ──────────────────────────────────────────────────────────
  {
    id: "canyon-fire",
    name: "Canyon Fire",
    glassColor: "12 45% 14%",
    accentColor: { primary: "18 78% 52%", secondary: "12 48% 38%", input: "15 40% 34%", border: "10 32% 20%" },
    greetingGradient: { start: "18 75% 68%", mid: "12 70% 58%", end: "28 80% 62%" },
    bubbleColors: { aiStart: "10 38% 12%", aiEnd: "12 32% 16%", userStart: "18 68% 38%", userEnd: "12 62% 36%" },
    base: "linear-gradient(180deg, hsl(200,30%,20%) 0%, hsl(15,50%,18%) 30%, hsl(12,55%,22%) 60%, hsl(10,40%,10%) 100%)",
    layers: [],
  },

  // ── 06  Brushfire ────────────────────────────────────────────────────────────
  {
    id: "brushfire",
    name: "Brushfire",
    glassColor: "15 40% 12%",
    accentColor: { primary: "28 85% 55%", secondary: "18 48% 38%", input: "20 38% 34%", border: "15 30% 18%" },
    greetingGradient: { start: "42 88% 72%", mid: "28 82% 60%", end: "15 70% 55%" },
    bubbleColors: { aiStart: "15 35% 12%", aiEnd: "18 30% 16%", userStart: "28 72% 40%", userEnd: "20 68% 38%" },
    base: "linear-gradient(180deg, hsl(42,80%,30%) 0%, hsl(28,75%,22%) 25%, hsl(15,60%,16%) 50%, hsl(10,50%,10%) 75%, hsl(280,30%,10%) 100%)",
    layers: [],
  },
];

export const DEFAULT_SUNSET_WALLPAPER = "starry-dusk";

export function getSelectedSunsetWallpaper(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_SUNSET_WALLPAPER;
}

export function setSelectedSunsetWallpaper(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new Event("wallpaperchange"));
}

export function getSunsetPresetById(id: string): WallpaperPreset | undefined {
  return sunsetWallpaperPresets.find((p) => p.id === id);
}
