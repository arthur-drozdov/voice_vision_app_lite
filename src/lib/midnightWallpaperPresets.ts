/**
 * Midnight Theme — Wallpaper Presets (4 presets, CSS-only)
 *
 * 1. Celestial Map    — rotating constellations (Signature)
 * 2. Violet Nebula    — nebula blobs + twinkling stars
 * 3. Moon Phases      — CSS moons appear/disappear
 * 4. Moon Glow        — gradient moon glow
 *
 * Selection stored in localStorage under "voicevision_bg_midnight".
 */

import type { WallpaperPreset } from "./wallpaperPresets";

const STORAGE_KEY = "voicevision_bg_midnight";

export const midnightWallpaperPresets: WallpaperPreset[] = [
  // ── 01  Celestial Map (Signature) ────────────────────────────────────────────
  {
    id: "celestial-map",
    name: "Celestial Map",
    previewImage: "/backgrounds/midnight-celestial-map.png",
    glassColor: "252 38% 24%",
    accentColor: { primary: "262 55% 58%", secondary: "252 35% 55%", input: "250 32% 50%", border: "250 30% 30%" },
    greetingGradient: { start: "240 30% 78%", mid: "250 40% 70%", end: "42 50% 68%" },
    bubbleColors: { aiStart: "248 35% 26%", aiEnd: "258 30% 32%", userStart: "258 45% 45%", userEnd: "270 40% 50%" },
    base: "radial-gradient(ellipse 90% 75% at 50% 40%, hsl(252,38%,20%) 0%, hsl(248,35%,15%) 55%, hsl(240,32%,12%) 100%)",
    layers: [],
  },

  // ── 02  Violet Nebula ────────────────────────────────────────────────────────
  {
    id: "violet-nebula",
    name: "Violet Nebula",
    previewImage: "/backgrounds/midnight-violet-nebula.png",
    glassColor: "255 45% 22%",
    accentColor: { primary: "262 55% 58%", secondary: "275 50% 55%", input: "262 40% 50%", border: "262 35% 30%" },
    greetingGradient: { start: "240 30% 82%", mid: "250 45% 72%", end: "220 40% 70%" },
    bubbleColors: { aiStart: "240 24% 22%", aiEnd: "260 20% 28%", userStart: "262 65% 52%", userEnd: "280 55% 48%" },
    base: "hsl(240, 28%, 10%)",
    layers: [],
  },

  // ── 03  Moon Phases ──────────────────────────────────────────────────────────
  {
    id: "moon-phases",
    name: "Moon Phases",
    previewImage: "/backgrounds/midnight-moon-phases-new.png",
    glassColor: "215 40% 16%",
    accentColor: { primary: "210 60% 55%", secondary: "220 45% 50%", input: "215 40% 45%", border: "215 35% 25%" },
    greetingGradient: { start: "0 0% 92%", mid: "210 45% 72%", end: "200 40% 68%" },
    bubbleColors: { aiStart: "215 30% 18%", aiEnd: "220 28% 24%", userStart: "210 60% 45%", userEnd: "220 55% 42%" },
    base: "radial-gradient(ellipse 100% 65% at 50% 0%, hsl(215,35%,12%) 0%, hsl(218,32%,9%) 30%, hsl(220,30%,7%) 50%, hsl(222,28%,5%) 100%)",
    layers: [],
  },

  // ── 04  Moon Glow ────────────────────────────────────────────────────────────
  {
    id: "moon-glow",
    name: "Moon Glow",
    previewImage: "/backgrounds/midnight-moon-glow.png",
    glassColor: "248 40% 20%",
    accentColor: { primary: "262 55% 58%", secondary: "250 40% 55%", input: "248 35% 50%", border: "248 30% 28%" },
    greetingGradient: { start: "0 0% 92%", mid: "250 40% 72%", end: "220 35% 68%" },
    bubbleColors: { aiStart: "244 28% 20%", aiEnd: "250 25% 26%", userStart: "262 55% 48%", userEnd: "280 50% 45%" },
    base: "radial-gradient(ellipse 100% 65% at 50% 0%, hsl(248,38%,18%) 0%, hsl(244,34%,13%) 50%, hsl(240,30%,9%) 100%)",
    layers: [],
  },
];

export const DEFAULT_MIDNIGHT_WALLPAPER = "celestial-map";

export function getSelectedMidnightWallpaper(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_MIDNIGHT_WALLPAPER;
}

export function setSelectedMidnightWallpaper(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new Event("wallpaperchange"));
}

export function getMidnightPresetById(id: string): WallpaperPreset | undefined {
  return midnightWallpaperPresets.find((p) => p.id === id);
}
