/**
 * Background Wallpaper Presets
 *
 * 5 background presets that apply across all pages.
 * These are independent of the colour theme — the theme controls UI chrome
 * (panels, bubbles, buttons), while the wallpaper controls only the background.
 *
 * Selection stored in localStorage under "voicevision_bg_default".
 */

export interface WallpaperPreset {
  id: string;
  name: string;
  /** CSS background for the base layer */
  base: string;
  /** Optional CSS backgrounds for glow/orb layers */
  layers?: { bg: string; blur?: number; animation?: string }[];
  /** HSL value for --surface-glass when this preset is active */
  glassColor: string;
  /** Dynamic UI accent colours matched to this wallpaper */
  accentColor?: {
    primary: string;     // switch ON, slider filled, buttons
    secondary: string;   // slider tracks, card backgrounds
    input: string;       // switch OFF state, form inputs
    border: string;      // card/section borders
  };
  /** Greeting text gradient colours (HSL strings) */
  greetingGradient?: { start: string; mid: string; end: string };
  /** Chat bubble gradient colours — should contrast with background */
  bubbleColors?: {
    aiStart: string;
    aiEnd: string;
    userStart: string;
    userEnd: string;
  };
  /** Path to textured background image (in public/) */
  backgroundImage?: string;
}

const STORAGE_KEY = "voicevision_bg_default";

export const wallpaperPresets: WallpaperPreset[] = [
  {
    id: "pearl-dusk",
    name: "Obsidian",
    glassColor: "215 18% 10%",
    accentColor: { primary: "210 35% 42%", secondary: "215 10% 28%", input: "215 12% 25%", border: "215 15% 18%" },
    greetingGradient: { start: "210 20% 58%", mid: "220 15% 48%", end: "30 12% 48%" },
    bubbleColors: { aiStart: "215 18% 16%", aiEnd: "220 15% 22%", userStart: "210 20% 20%", userEnd: "215 15% 28%" },
    backgroundImage: "/backgrounds/pearl-dusk.png",
    base: "linear-gradient(155deg, hsl(220,18%,8%) 0%, hsl(215,22%,12%) 20%, hsl(210,18%,15%) 40%, hsl(25,12%,12%) 60%, hsl(220,15%,10%) 80%, hsl(215,20%,6%) 100%)",
    layers: [
      { bg: "radial-gradient(ellipse at 30% 25%, hsla(210,35%,35%,0.40) 0%, transparent 50%)", blur: 25, animation: "theme-marble-drift 16s ease-in-out infinite" },
      { bg: "radial-gradient(ellipse at 70% 70%, hsla(30,25%,30%,0.35) 0%, transparent 45%)", blur: 22, animation: "theme-marble-drift 20s ease-in-out infinite reverse" },
      { bg: "radial-gradient(ellipse at 50% 10%, hsla(215,20%,40%,0.25) 0%, transparent 40%)", blur: 20, animation: "theme-marble-drift 24s ease-in-out infinite 6s" },
    ],
  },
  {
    id: "signature",
    name: "Signature",
    glassColor: "210 50% 22%",
    accentColor: { primary: "210 65% 55%", secondary: "210 18% 65%", input: "210 22% 62%", border: "210 40% 30%" },
    greetingGradient: { start: "195 80% 80%", mid: "210 65% 70%", end: "172 60% 65%" },
    bubbleColors: { aiStart: "240 30% 32%", aiEnd: "220 35% 40%", userStart: "195 55% 38%", userEnd: "172 50% 45%" },
    backgroundImage: "/backgrounds/signature.png",
    base: "linear-gradient(155deg, hsl(200,55%,75%) 0%, hsl(210,60%,50%) 18%, hsl(225,50%,30%) 35%, hsl(175,55%,16%) 55%, hsl(172,50%,8%) 75%, hsl(175,45%,5%) 100%)",
    layers: [
      { bg: "radial-gradient(circle, hsla(195,85%,82%,0.50) 0%, transparent 65%)", blur: 30, animation: "theme-marble-drift 13s ease-in-out infinite" },
      { bg: "radial-gradient(circle, hsla(270,65%,74%,0.40) 0%, transparent 65%)", blur: 22, animation: "theme-marble-drift 16s ease-in-out infinite reverse" },
      { bg: "radial-gradient(circle, hsla(38,75%,68%,0.45) 0%, transparent 65%)", blur: 20, animation: "theme-marble-drift 19s ease-in-out infinite 5s" },
    ],
  },
  {
    id: "cosmic-teal",
    name: "Cosmic Teal",
    glassColor: "180 50% 20%",
    accentColor: { primary: "180 65% 50%", secondary: "180 20% 63%", input: "180 25% 58%", border: "180 45% 28%" },
    greetingGradient: { start: "172 75% 65%", mid: "195 65% 75%", end: "200 60% 80%" },
    bubbleColors: { aiStart: "260 42% 38%", aiEnd: "280 40% 46%", userStart: "168 55% 35%", userEnd: "185 50% 42%" },
    backgroundImage: "/backgrounds/cosmic-teal.png",
    base: "linear-gradient(155deg, hsl(168,65%,32%) 0%, hsl(185,70%,22%) 20%, hsl(200,55%,28%) 40%, hsl(175,60%,24%) 60%, hsl(155,55%,35%) 80%, hsl(180,60%,16%) 100%)",
    layers: [
      { bg: "radial-gradient(ellipse at 30% 20%, hsla(168,90%,58%,0.60) 0%, hsla(175,75%,42%,0.22) 40%, transparent 60%)", blur: 25, animation: "theme-marble-drift 14s ease-in-out infinite" },
      { bg: "radial-gradient(ellipse at 70% 75%, hsla(260,60%,52%,0.55) 0%, hsla(270,50%,40%,0.22) 40%, transparent 60%)", blur: 28, animation: "theme-marble-drift 18s ease-in-out infinite reverse" },
      { bg: "radial-gradient(ellipse at 50% 50%, hsla(180,75%,72%,0.28) 0%, transparent 50%)", blur: 20, animation: "theme-marble-drift 22s ease-in-out infinite 4s" },
      { bg: "radial-gradient(ellipse at 20% 65%, hsla(200,70%,62%,0.38) 0%, transparent 50%)", blur: 22, animation: "theme-marble-drift 16s ease-in-out infinite 8s" },
      { bg: "radial-gradient(ellipse at 80% 30%, hsla(290,50%,58%,0.32) 0%, transparent 45%)", blur: 20, animation: "theme-marble-drift 20s ease-in-out infinite reverse 3s" },
    ],
  },
  {
    id: "iridescent-mid",
    name: "Iridescent",
    glassColor: "240 40% 22%",
    accentColor: { primary: "260 60% 60%", secondary: "250 18% 67%", input: "250 22% 62%", border: "250 35% 30%" },
    greetingGradient: { start: "200 60% 82%", mid: "260 55% 75%", end: "172 60% 65%" },
    bubbleColors: { aiStart: "210 40% 32%", aiEnd: "250 35% 40%", userStart: "270 40% 38%", userEnd: "310 35% 45%" },
    backgroundImage: "/backgrounds/iridescent.png",
    base: "linear-gradient(145deg, hsl(172,55%,24%) 0%, hsl(210,60%,26%) 25%, hsl(265,50%,24%) 50%, hsl(280,45%,20%) 70%, hsl(172,50%,18%) 100%)",
    layers: [
      { bg: "radial-gradient(circle, hsla(172,92%,62%,0.50) 0%, transparent 65%)", blur: 28, animation: "theme-marble-drift 11s ease-in-out infinite" },
      { bg: "radial-gradient(circle, hsla(270,70%,74%,0.45) 0%, transparent 65%)", blur: 25, animation: "theme-marble-drift 14s ease-in-out infinite reverse" },
      { bg: "radial-gradient(circle, hsla(38,75%,65%,0.32) 0%, transparent 65%)", blur: 22, animation: "theme-marble-drift 17s ease-in-out infinite 6s" },
    ],
  },
  {
    id: "teal-dawn",
    name: "Pearl Dusk",
    glassColor: "300 30% 22%",
    accentColor: { primary: "290 50% 55%", secondary: "300 18% 68%", input: "295 22% 62%", border: "295 30% 30%" },
    greetingGradient: { start: "200 60% 82%", mid: "270 55% 72%", end: "290 40% 80%" },
    bubbleColors: { aiStart: "240 30% 34%", aiEnd: "260 32% 42%", userStart: "340 40% 40%", userEnd: "320 35% 48%" },
    backgroundImage: "/backgrounds/rose-quartz.png",
    base: "linear-gradient(170deg, hsl(290,50%,82%) 0%, hsl(335,45%,58%) 20%, hsl(325,38%,32%) 40%, hsl(315,32%,16%) 65%, hsl(300,28%,8%) 100%)",
    layers: [
      { bg: "radial-gradient(ellipse at 45% 0%, hsla(290,55%,84%,0.58) 0%, hsla(335,50%,62%,0.28) 35%, transparent 65%)", animation: "theme-sunset-pulse 6s ease-in-out infinite" },
      { bg: "radial-gradient(ellipse at 70% 60%, hsla(38,80%,65%,0.32) 0%, transparent 50%)", blur: 20, animation: "theme-marble-drift 15s ease-in-out infinite reverse" },
      { bg: "radial-gradient(ellipse at 25% 80%, hsla(200,65%,84%,0.30) 0%, transparent 45%)", blur: 18, animation: "theme-marble-drift 20s ease-in-out infinite 4s" },
    ],
  },
];

export const DEFAULT_WALLPAPER = "signature";

export function getSelectedWallpaper(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_WALLPAPER;
}

export function setSelectedWallpaper(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new Event("wallpaperchange"));
}

export function getPresetById(id: string): WallpaperPreset | undefined {
  return wallpaperPresets.find((p) => p.id === id);
}
