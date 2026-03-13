/**
 * Midnight Theme — Wallpaper Presets (4 presets, CSS-only)
 *
 * 1. Lavender Mist   — rotating constellations
 * 2. Violet Nebula    — nebula blobs + twinkling stars
 * 3. Moon Phases      — CSS moons appear/disappear
 * 4. Celestial Map    — cycling constellation groups (Signature)
 *
 * Selection stored in localStorage under "voicevision_bg_midnight".
 */

import type { WallpaperPreset } from "./wallpaperPresets";

const STORAGE_KEY = "voicevision_bg_midnight";

export const midnightWallpaperPresets: WallpaperPreset[] = [
  // ── 01  Lavender Mist ────────────────────────────────────────────────────────
  {
    id: "lavender-mist",
    name: "Lavender Mist",
    glassColor: "252 38% 24%",
    accentColor: { primary: "258 55% 58%", secondary: "252 35% 55%", input: "250 32% 50%", border: "250 30% 30%" },
    greetingGradient: { start: "258 50% 78%", mid: "250 45% 72%", end: "42 60% 72%" },
    bubbleColors: { aiStart: "248 35% 26%", aiEnd: "258 30% 32%", userStart: "258 45% 45%", userEnd: "270 40% 50%" },
    base: "radial-gradient(ellipse 90% 75% at 50% 40%, hsl(252,38%,20%) 0%, hsl(248,35%,15%) 55%, hsl(240,32%,12%) 100%)",
    layers: [],
  },

  // ── 02  Violet Nebula ────────────────────────────────────────────────────────
  {
    id: "violet-nebula",
    name: "Violet Nebula",
    glassColor: "255 45% 22%",
    accentColor: { primary: "262 85% 70%", secondary: "275 50% 55%", input: "262 40% 50%", border: "262 35% 30%" },
    greetingGradient: { start: "262 75% 82%", mid: "280 65% 75%", end: "320 55% 75%" },
    bubbleColors: { aiStart: "240 24% 22%", aiEnd: "260 20% 28%", userStart: "262 65% 52%", userEnd: "280 55% 48%" },
    base: "hsl(240, 28%, 10%)",
    layers: [],
  },

  // ── 03  Moon Phases ──────────────────────────────────────────────────────────
  {
    id: "moon-phases",
    name: "Moon Phases",
    glassColor: "248 40% 20%",
    accentColor: { primary: "262 72% 68%", secondary: "250 40% 55%", input: "248 35% 50%", border: "248 30% 28%" },
    greetingGradient: { start: "0 0% 96%", mid: "262 65% 78%", end: "320 55% 75%" },
    bubbleColors: { aiStart: "244 28% 20%", aiEnd: "250 25% 26%", userStart: "262 55% 48%", userEnd: "280 50% 45%" },
    base: "radial-gradient(ellipse 100% 65% at 50% 0%, hsl(248,38%,14%) 0%, hsl(244,34%,10%) 50%, hsl(240,30%,7%) 100%)",
    layers: [],
  },

  // ── 04  Moon Glow (Original CSS gradient moon) ──────────────────────────────
  {
    id: "moon-glow",
    name: "Moon Glow",
    glassColor: "248 40% 20%",
    accentColor: { primary: "262 72% 68%", secondary: "250 40% 55%", input: "248 35% 50%", border: "248 30% 28%" },
    greetingGradient: { start: "0 0% 96%", mid: "262 65% 78%", end: "320 55% 75%" },
    bubbleColors: { aiStart: "244 28% 20%", aiEnd: "250 25% 26%", userStart: "262 55% 48%", userEnd: "280 50% 45%" },
    base: "radial-gradient(ellipse 100% 65% at 50% 0%, hsl(248,38%,18%) 0%, hsl(244,34%,13%) 50%, hsl(240,30%,9%) 100%)",
    layers: [
      { bg: "radial-gradient(circle at 50% 18%, hsla(0,0%,96%,0.75) 0%, hsla(0,0%,96%,0) 5%)", blur: 0, animation: "midnight-moon-float 9s ease-in-out infinite" },
      { bg: "radial-gradient(circle at 50% 18%, hsla(262,72%,68%,0.35) 0%, transparent 14%)", blur: 12, animation: "midnight-moon-float 9s ease-in-out infinite" },
      { bg: "radial-gradient(circle at 50% 18%, hsla(320,55%,60%,0.18) 0%, transparent 20%)", blur: 18, animation: "midnight-moon-float 9s ease-in-out infinite" },
      { bg: "radial-gradient(circle at 50% 18%, hsla(262,60%,42%,0.28) 0%, transparent 30%)", blur: 25, animation: "midnight-moon-float 9s ease-in-out infinite" },
    ],
  },

  // ── 04  Moon Phases Classic (PNG) ────────────────────────────────────────────
  {
    id: "moon-phases-classic",
    name: "Moon Classic",
    backgroundImage: "/backgrounds/midnight-moon-phases.png",
    glassColor: "248 40% 20%",
    accentColor: { primary: "262 72% 68%", secondary: "250 40% 55%", input: "248 35% 50%", border: "248 30% 28%" },
    greetingGradient: { start: "0 0% 96%", mid: "262 65% 78%", end: "320 55% 75%" },
    bubbleColors: { aiStart: "244 28% 20%", aiEnd: "250 25% 26%", userStart: "262 55% 48%", userEnd: "280 50% 45%" },
    base: "hsl(240, 28%, 7%)",
    layers: [],
  },

  // ── 04  Celestial Map (Signature) ────────────────────────────────────────────
  {
    id: "celestial-map",
    name: "Celestial Map",
    glassColor: "255 45% 22%",
    accentColor: { primary: "262 85% 70%", secondary: "240 20% 28%", input: "240 20% 32%", border: "240 20% 32%" },
    greetingGradient: { start: "262 80% 82%", mid: "42 70% 74%", end: "320 65% 78%" },
    bubbleColors: { aiStart: "240 24% 22%", aiEnd: "260 20% 28%", userStart: "262 80% 55%", userEnd: "290 70% 50%" },
    base: "radial-gradient(ellipse 92% 72% at 50% 38%, hsl(252,42%,14%) 0%, hsl(262,38%,11%) 50%, hsl(248,35%,8%) 100%)",
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
