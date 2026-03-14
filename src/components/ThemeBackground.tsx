import { useState, useEffect, useMemo } from "react";
import { getSelectedWallpaper, getPresetById } from "@/lib/wallpaperPresets";
import { getSelectedMidnightWallpaper, getMidnightPresetById } from "@/lib/midnightWallpaperPresets";
import MidnightThreeCanvas from "@/components/MidnightThreeCanvas";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const Blob = ({ style }: { style: React.CSSProperties }) => (
  <div className="absolute" style={{ pointerEvents: "none", ...style }} />
);

const Vein = ({ style }: { style: React.CSSProperties }) => (
  <div className="absolute" style={{ pointerEvents: "none", ...style }} />
);

// ─── Default: renders the selected wallpaper preset ─────────────────────────
const DefaultBg = () => {
  const [presetId, setPresetId] = useState(getSelectedWallpaper);

  useEffect(() => {
    const handler = () => setPresetId(getSelectedWallpaper());
    window.addEventListener("wallpaperchange", handler);
    return () => window.removeEventListener("wallpaperchange", handler);
  }, []);

  const preset = useMemo(() => getPresetById(presetId), [presetId]);

  // Update glass colour and accent colours to match wallpaper preset
  // ONLY applies when the active theme is "default" — other themes handle their own vars
  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = root.dataset.theme;

    // Only apply wallpaper overrides for the default theme
    if (currentTheme && currentTheme !== "default" && currentTheme !== "custom") return;
    if (!preset) return;

    if (preset.glassColor) {
      root.style.setProperty("--surface-glass", preset.glassColor);
      root.style.setProperty("--popover", preset.glassColor);
      root.style.setProperty("--card", preset.glassColor);
    }
    if (preset.accentColor) {
      root.style.setProperty("--secondary", preset.accentColor.secondary);
      root.style.setProperty("--input", preset.accentColor.input);
      root.style.setProperty("--border", preset.accentColor.border);
      if (preset.accentColor.primary) {
        root.style.setProperty("--primary", preset.accentColor.primary);
        root.style.setProperty("--ring", preset.accentColor.primary);
        root.style.setProperty("--glow-primary", preset.accentColor.primary);
      }
    }
    if (preset.greetingGradient) {
      root.style.setProperty("--greeting-start", preset.greetingGradient.start);
      root.style.setProperty("--greeting-mid", preset.greetingGradient.mid);
      root.style.setProperty("--greeting-end", preset.greetingGradient.end);
    }
    if (preset.bubbleColors) {
      root.style.setProperty("--bubble-ai-start", preset.bubbleColors.aiStart);
      root.style.setProperty("--bubble-ai-end", preset.bubbleColors.aiEnd);
      root.style.setProperty("--bubble-user-start", preset.bubbleColors.userStart);
      root.style.setProperty("--bubble-user-end", preset.bubbleColors.userEnd);
    }
  }, [preset]);

  if (!preset) return <DefaultFallbackBg />;

  return (
    <>
      {/* Base gradient fallback */}
      <div className="absolute inset-0" style={{ background: preset.base }} />

      {/* Textured background image — primary visual layer */}
      {preset.backgroundImage && (
        <img
          src={preset.backgroundImage}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
            animation: "bg-breathe 25s ease-in-out infinite, bg-hue-drift 40s ease-in-out infinite",
            willChange: "transform, filter",
          }}
        />
      )}

      {/* Layered orbs / glows (subtle, on top of image) */}
      {preset.layers?.map((layer, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "-20%",
            left: "-20%",
            width: "140%",
            height: "140%",
            background: layer.bg,
            filter: layer.blur ? `blur(${layer.blur}px)` : undefined,
            animation: layer.animation,
            borderRadius: "50%",
            pointerEvents: "none" as const,
            willChange: "transform",
            opacity: 0.4,
          }}
        />
      ))}
    </>
  );
};

// Fallback if preset not found — the old DefaultBg (Abyssal Jade)
const DefaultFallbackBg = () => (
  <>
    <Blob style={{
      width: "150vw", height: "110vw",
      top: "-30%", left: "-30%",
      borderRadius: "42% 58% 55% 45% / 50% 44% 56% 50%",
      background: "radial-gradient(ellipse 55% 45% at 42% 48%, hsl(172 85% 30% / 0.75) 0%, hsl(195 70% 20% / 0.45) 48%, transparent 70%)",
      filter: "blur(50px)",
      animation: "theme-marble-drift 32s ease-in-out infinite",
    }} />
    <Blob style={{
      width: "120vw", height: "95vw",
      bottom: "-25%", right: "-25%",
      borderRadius: "55% 45% 42% 58% / 46% 54% 50% 50%",
      background: "radial-gradient(ellipse 52% 55% at 55% 48%, hsl(288 72% 38% / 0.70) 0%, hsl(265 55% 25% / 0.40) 50%, transparent 70%)",
      filter: "blur(60px)",
      animation: "theme-marble-drift 40s ease-in-out infinite reverse 8s",
    }} />
    <Blob style={{
      width: "55vw", height: "35vw",
      top: "35%", left: "25%",
      borderRadius: "50%",
      background: "radial-gradient(ellipse, hsl(172 95% 55% / 0.28) 0%, transparent 65%)",
      filter: "blur(30px)",
      animation: "theme-marble-drift 56s ease-in-out infinite 15s",
    }} />
    <Vein style={{
      width: "160%", height: "100px",
      top: "26%", left: "-30%",
      transform: "rotate(-7deg)",
      background: "linear-gradient(to right, transparent 0%, hsl(172 90% 70% / 0.12) 30%, hsl(172 95% 82% / 0.20) 52%, hsl(172 90% 70% / 0.10) 74%, transparent 100%)",
      filter: "blur(6px)",
      animation: "theme-sunset-pulse 16s ease-in-out infinite 4s",
    }} />
    <Vein style={{
      width: "130%", height: "72px",
      bottom: "34%", left: "-12%",
      transform: "rotate(10deg)",
      background: "linear-gradient(to right, transparent 0%, hsl(290 78% 72% / 0.14) 38%, hsl(290 78% 82% / 0.12) 62%, transparent 100%)",
      filter: "blur(5px)",
      animation: "theme-sunset-pulse 22s ease-in-out infinite 8s",
    }} />
  </>
);

// ─── Midnight: Celestial wallpaper preset system (Three.js) ─────────────────

// Presets that have a Three.js scene builder
const THREE_JS_PRESETS = new Set(["violet-nebula", "moon-phases", "moon-glow", "lavender-mist", "celestial-map"]);

const MidnightBg = () => {
  const [presetId, setPresetId] = useState(getSelectedMidnightWallpaper);

  useEffect(() => {
    const handler = () => setPresetId(getSelectedMidnightWallpaper());
    window.addEventListener("wallpaperchange", handler);
    return () => window.removeEventListener("wallpaperchange", handler);
  }, []);

  const preset = useMemo(() => getMidnightPresetById(presetId), [presetId]);

  // Apply CSS variable overrides for this wallpaper preset
  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = root.dataset.theme;
    if (currentTheme !== "midnight") return;
    if (!preset) return;

    if (preset.glassColor) {
      root.style.setProperty("--surface-glass", preset.glassColor);
      root.style.setProperty("--popover", preset.glassColor);
      root.style.setProperty("--card", preset.glassColor);
    }
    if (preset.accentColor) {
      root.style.setProperty("--secondary", preset.accentColor.secondary);
      root.style.setProperty("--input", preset.accentColor.input);
      root.style.setProperty("--border", preset.accentColor.border);
      if (preset.accentColor.primary) {
        root.style.setProperty("--primary", preset.accentColor.primary);
        root.style.setProperty("--ring", preset.accentColor.primary);
        root.style.setProperty("--glow-primary", preset.accentColor.primary);
      }
    }
    if (preset.greetingGradient) {
      root.style.setProperty("--greeting-start", preset.greetingGradient.start);
      root.style.setProperty("--greeting-mid", preset.greetingGradient.mid);
      root.style.setProperty("--greeting-end", preset.greetingGradient.end);
    }
    if (preset.bubbleColors) {
      root.style.setProperty("--bubble-ai-start", preset.bubbleColors.aiStart);
      root.style.setProperty("--bubble-ai-end", preset.bubbleColors.aiEnd);
      root.style.setProperty("--bubble-user-start", preset.bubbleColors.userStart);
      root.style.setProperty("--bubble-user-end", preset.bubbleColors.userEnd);
    }
  }, [preset]);

  if (!preset) {
    return (
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 92% 72% at 50% 38%, hsl(252,48%,16%) 0%, hsl(262,45%,13%) 50%, hsl(248,42%,10%) 100%)",
      }} />
    );
  }

  return (
    <>
      {/* Base gradient — skip for moon-phases (has its own dithered shader bg) */}
      {presetId !== "moon-phases" && (
        <div className="absolute inset-0" style={{ background: preset.base, filter: "blur(0.6px)" }} />
      )}
      {preset.backgroundImage && (
        <img
          src={preset.backgroundImage}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
            animation: "bg-breathe 25s ease-in-out infinite",
            willChange: "transform",
          }}
        />
      )}
      {/* Three.js animated background */}
      {THREE_JS_PRESETS.has(presetId) && (
        <MidnightThreeCanvas presetId={presetId} />
      )}

      {/* ── CSS Overlay Layers — per-subtheme visibility ── */}

      {/* Constellation dot grid — hide on lavender-mist (has own grid) and violet-nebula (too busy) and moon-phases */}
      {presetId !== "lavender-mist" && presetId !== "violet-nebula" && presetId !== "moon-phases" && (
        <div
          className="midnight-constellation-grid"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(circle 1.5px at center, hsla(262,70%,75%,0.20) 0%, transparent 100%)",
            backgroundSize: "42px 42px",
            animation: "constFade 14s ease-in-out infinite alternate",
          }}
        />
      )}

      {/* CSS Moon — hide on violet-nebula (nebula is hero), moon-phases (9 moons are hero), moon-glow (3D moon is hero) */}
      {presetId !== "violet-nebula" && presetId !== "moon-phases" && presetId !== "moon-glow" && (
        <div
          className="midnight-moon"
          style={{
            position: "absolute",
            top: -55,
            right: 50,
            width: 220,
            height: 220,
            borderRadius: "50%",
            // Realistic moon surface: base + mare (dark seas) + highlands + craters
            background: presetId === "lavender-mist"
              ? `radial-gradient(circle at 40% 40%, hsla(45,60%,88%,0.9) 0%, hsl(40,35%,60%) 50%, transparent 72%)`
              : [
                // Asymmetric light side — brighter upper-left, dimmer lower-right
                "radial-gradient(circle at 32% 30%, hsla(0,0%,98%,0.95) 0%, hsla(0,0%,88%,0.6) 20%, transparent 50%)",
                // Large dark maria — irregular shapes, strong contrast
                "radial-gradient(ellipse 32% 28% at 55% 35%, hsla(230,12%,38%,0.50) 0%, transparent 100%)",
                "radial-gradient(ellipse 38% 42% at 28% 52%, hsla(215,10%,42%,0.45) 0%, transparent 100%)",
                "radial-gradient(ellipse 25% 20% at 42% 25%, hsla(225,10%,36%,0.40) 0%, transparent 100%)",
                "radial-gradient(ellipse 20% 16% at 50% 30%, hsla(235,12%,40%,0.38) 0%, transparent 100%)",
                "radial-gradient(ellipse 12% 10% at 65% 35%, hsla(220,14%,35%,0.42) 0%, transparent 100%)",
                // Rough highland patches — lighter, warm-tinted
                "radial-gradient(ellipse 22% 25% at 68% 55%, hsla(38,14%,72%,0.30) 0%, transparent 100%)",
                "radial-gradient(ellipse 18% 14% at 25% 30%, hsla(32,10%,68%,0.25) 0%, transparent 100%)",
                "radial-gradient(ellipse 14% 18% at 72% 28%, hsla(40,8%,70%,0.22) 0%, transparent 100%)",
                // Bright crater rays — asymmetric splashes
                "radial-gradient(circle 8px at 46% 66%, hsla(0,0%,96%,0.65) 0%, hsla(0,0%,85%,0.20) 50%, transparent 100%)",
                "radial-gradient(ellipse 15% 4% at 46% 66%, hsla(0,0%,92%,0.30) 0%, transparent 100%)",
                "radial-gradient(ellipse 4% 12% at 46% 66%, hsla(0,0%,90%,0.25) 0%, transparent 100%)",
                // More craters — various sizes
                "radial-gradient(circle 6px at 33% 40%, hsla(0,0%,90%,0.45) 0%, hsla(230,5%,60%,0.15) 80%, transparent 100%)",
                "radial-gradient(circle 4px at 24% 44%, hsla(0,0%,88%,0.38) 0%, transparent 100%)",
                "radial-gradient(circle 3px at 20% 36%, hsla(0,0%,93%,0.48) 0%, transparent 100%)",
                "radial-gradient(circle 5px at 40% 20%, hsla(225,8%,35%,0.35) 0%, transparent 100%)",
                "radial-gradient(circle 4px at 17% 50%, hsla(218,10%,32%,0.32) 0%, transparent 100%)",
                "radial-gradient(circle 3px at 58% 52%, hsla(0,0%,78%,0.28) 0%, transparent 100%)",
                // Scattered roughness — many tiny dark/light spots
                "radial-gradient(circle 2px at 38% 48%, hsla(225,6%,55%,0.22) 0%, transparent 100%)",
                "radial-gradient(circle 2px at 52% 58%, hsla(0,0%,80%,0.20) 0%, transparent 100%)",
                "radial-gradient(circle 1px at 60% 25%, hsla(0,0%,92%,0.25) 0%, transparent 100%)",
                "radial-gradient(circle 2px at 45% 42%, hsla(220,8%,50%,0.18) 0%, transparent 100%)",
                "radial-gradient(circle 1px at 30% 60%, hsla(0,0%,85%,0.22) 0%, transparent 100%)",
                "radial-gradient(circle 2px at 62% 45%, hsla(230,5%,58%,0.16) 0%, transparent 100%)",
                "radial-gradient(circle 1px at 55% 35%, hsla(0,0%,75%,0.20) 0%, transparent 100%)",
                // Non-uniform base — darker on right, lighter left
                "radial-gradient(ellipse 55% 55% at 40% 45%, hsl(240,5%,75%) 0%, hsl(245,10%,58%) 40%, hsl(250,12%,48%) 65%, transparent 75%)",
              ].join(", "),
            boxShadow: presetId === "lavender-mist"
              ? "0 0 60px 20px hsla(42,65%,60%,0.20), 0 0 120px 40px hsla(42,50%,45%,0.10), inset -15px -10px 30px hsla(40,20%,30%,0.3)"
              : "0 0 60px 20px hsla(262,85%,70%,0.25), 0 0 120px 40px hsla(262,70%,55%,0.12), inset -15px -10px 30px hsla(240,30%,15%,0.4)",
            pointerEvents: "none",
            animation: "moonGlow 10s ease-in-out infinite alternate",
          }}
        />
      )}

      {/* Saturn now rendered by Three.js in midnightScenes.ts */}

    </>
  );
};

// ─── Forest: Malachite ─────────────────────────────────────────────────────────
// Rich dark-emerald fluid — the green the user loved in the preview.
const ForestBg = () => (
  <>
    {/* Primary deep emerald mass */}
    <Blob style={{
      width: "160vw", height: "125vw",
      top: "-38%", left: "-35%",
      borderRadius: "42% 58% 54% 46% / 48% 44% 56% 52%",
      background: "radial-gradient(ellipse 52% 44% at 42% 50%, hsl(155 78% 28% / 0.80) 0%, hsl(162 62% 18% / 0.50) 46%, transparent 70%)",
      filter: "blur(52px)",
      animation: "theme-marble-drift 30s ease-in-out infinite",
    }} />

    {/* Lime-green tendril — upper right */}
    <Blob style={{
      width: "115vw", height: "85vw",
      top: "-15%", right: "-25%",
      borderRadius: "56% 44% 48% 52% / 52% 50% 50% 48%",
      background: "radial-gradient(ellipse 50% 52% at 52% 46%, hsl(138 75% 30% / 0.68) 0%, hsl(120 55% 18% / 0.38) 50%, transparent 70%)",
      filter: "blur(58px)",
      animation: "theme-marble-drift 38s ease-in-out infinite reverse 7s",
    }} />

    {/* Dark teal shadow pool — depth */}
    <Blob style={{
      width: "130vw", height: "72vw",
      bottom: "-20%", left: "-8%",
      borderRadius: "50% 50% 45% 55% / 45% 50% 50% 55%",
      background: "radial-gradient(ellipse 62% 45% at 46% 55%, hsl(165 68% 16% / 0.72) 0%, transparent 70%)",
      filter: "blur(68px)",
      animation: "theme-marble-drift 46s ease-in-out infinite 12s",
    }} />

    {/* Bright emerald luminous pool */}
    <Blob style={{
      width: "50vw", height: "32vw",
      top: "40%", left: "30%",
      borderRadius: "50%",
      background: "radial-gradient(ellipse, hsl(155 88% 50% / 0.32) 0%, transparent 65%)",
      filter: "blur(26px)",
      animation: "theme-marble-drift 54s ease-in-out infinite 20s",
    }} />

    {/* Diagonal emerald vein */}
    <Vein style={{
      width: "170%", height: "110px",
      top: "22%", left: "-32%",
      transform: "rotate(-5deg)",
      background: "linear-gradient(to right, transparent 0%, hsl(155 88% 62% / 0.13) 30%, hsl(155 92% 76% / 0.22) 52%, hsl(155 88% 62% / 0.11) 74%, transparent 100%)",
      filter: "blur(7px)",
      animation: "theme-sunset-pulse 15s ease-in-out infinite 3s",
    }} />

    {/* Lime vein */}
    <Vein style={{
      width: "140%", height: "68px",
      top: "62%", left: "-8%",
      transform: "rotate(8deg)",
      background: "linear-gradient(to right, transparent 0%, hsl(82 78% 65% / 0.15) 38%, hsl(82 78% 80% / 0.13) 60%, transparent 100%)",
      filter: "blur(5px)",
      animation: "theme-sunset-pulse 20s ease-in-out infinite 7s",
    }} />
  </>
);

// ─── Sunset: Carnelian ─────────────────────────────────────────────────────────
// Warm amber fluid with deep crimson and molten-gold veins.
const SunsetBg = () => (
  <>
    {/* Primary amber fluid mass */}
    <Blob style={{
      width: "152vw", height: "115vw",
      bottom: "-35%", left: "-30%",
      borderRadius: "48% 52% 55% 45% / 52% 48% 52% 48%",
      background: "radial-gradient(ellipse 52% 46% at 48% 52%, hsl(28 90% 38% / 0.78) 0%, hsl(18 72% 22% / 0.48) 46%, transparent 70%)",
      filter: "blur(52px)",
      animation: "theme-marble-drift 34s ease-in-out infinite",
    }} />

    {/* Crimson tendril */}
    <Blob style={{
      width: "112vw", height: "88vw",
      top: "-20%", right: "-24%",
      borderRadius: "52% 48% 45% 55% / 50% 52% 48% 50%",
      background: "radial-gradient(ellipse 50% 52% at 52% 48%, hsl(350 80% 36% / 0.68) 0%, hsl(338 56% 22% / 0.40) 50%, transparent 70%)",
      filter: "blur(60px)",
      animation: "theme-marble-drift 42s ease-in-out infinite reverse 9s",
    }} />

    {/* Golden highlight pool */}
    <Blob style={{
      width: "52vw", height: "34vw",
      top: "34%", left: "26%",
      borderRadius: "50%",
      background: "radial-gradient(ellipse, hsl(45 96% 62% / 0.34) 0%, transparent 65%)",
      filter: "blur(28px)",
      animation: "theme-marble-drift 58s ease-in-out infinite 16s",
    }} />

    {/* Gold vein */}
    <Vein style={{
      width: "160%", height: "102px",
      top: "32%", left: "-28%",
      transform: "rotate(-7deg)",
      background: "linear-gradient(to right, transparent 0%, hsl(45 96% 72% / 0.15) 32%, hsl(45 96% 88% / 0.24) 52%, hsl(45 96% 72% / 0.12) 72%, transparent 100%)",
      filter: "blur(7px)",
      animation: "theme-sunset-pulse 14s ease-in-out infinite 4s",
    }} />

    {/* Crimson vein */}
    <Vein style={{
      width: "132%", height: "76px",
      bottom: "36%", right: "-16%",
      transform: "rotate(9deg)",
      background: "linear-gradient(to left, transparent 0%, hsl(350 84% 68% / 0.16) 38%, hsl(350 84% 82% / 0.14) 60%, transparent 100%)",
      filter: "blur(5px)",
      animation: "theme-sunset-pulse 20s ease-in-out infinite 7s",
    }} />
  </>
);

// ─── Ocean: Larimar ────────────────────────────────────────────────────────────
// Deep Caribbean teal with luminous cyan iridescence.
const OceanBg = () => (
  <>
    {/* Primary deep ocean mass */}
    <Blob style={{
      width: "158vw", height: "118vw",
      bottom: "-38%", left: "-30%",
      borderRadius: "50% 50% 52% 48% / 50% 48% 52% 50%",
      background: "radial-gradient(ellipse 52% 46% at 46% 50%, hsl(200 85% 30% / 0.78) 0%, hsl(195 66% 18% / 0.48) 46%, transparent 70%)",
      filter: "blur(54px)",
      animation: "theme-marble-drift 35s ease-in-out infinite",
    }} />

    {/* Cyan surface shimmer */}
    <Blob style={{
      width: "118vw", height: "88vw",
      top: "-18%", right: "-20%",
      borderRadius: "52% 48% 50% 50% / 48% 52% 50% 50%",
      background: "radial-gradient(ellipse 52% 48% at 50% 50%, hsl(200 88% 36% / 0.65) 0%, hsl(188 66% 22% / 0.38) 50%, transparent 70%)",
      filter: "blur(60px)",
      animation: "theme-marble-drift 44s ease-in-out infinite reverse 8s",
    }} />

    {/* Turquoise luminous pool */}
    <Blob style={{
      width: "50vw", height: "32vw",
      top: "38%", left: "30%",
      borderRadius: "50%",
      background: "radial-gradient(ellipse, hsl(175 85% 55% / 0.34) 0%, transparent 65%)",
      filter: "blur(26px)",
      animation: "theme-marble-drift 56s ease-in-out infinite 17s",
    }} />

    {/* Cyan vein */}
    <Vein style={{
      width: "166%", height: "96px",
      top: "29%", left: "-32%",
      transform: "rotate(-6deg)",
      background: "linear-gradient(to right, transparent 0%, hsl(200 92% 70% / 0.15) 32%, hsl(200 92% 86% / 0.24) 52%, hsl(200 92% 70% / 0.12) 72%, transparent 100%)",
      filter: "blur(7px)",
      animation: "theme-sunset-pulse 15s ease-in-out infinite 4s",
    }} />

    {/* Turquoise vein */}
    <Vein style={{
      width: "136%", height: "70px",
      bottom: "33%", right: "-18%",
      transform: "rotate(11deg)",
      background: "linear-gradient(to left, transparent 0%, hsl(175 85% 66% / 0.17) 38%, hsl(175 85% 80% / 0.15) 60%, transparent 100%)",
      filter: "blur(5px)",
      animation: "theme-sunset-pulse 22s ease-in-out infinite 8s",
    }} />
  </>
);

// ─── Focus / Calm: dark, low-saturation, minimal movement ────────────────────
const FocusBg = () => (
  <>
    {/* Single deep slate mass — very subtle drift */}
    <Blob style={{
      width: "140vw", height: "100vw",
      top: "-25%", left: "-20%",
      borderRadius: "50% 50% 48% 52% / 50% 48% 52% 50%",
      background: "radial-gradient(ellipse 55% 50% at 48% 50%, hsl(210 16% 14% / 0.80) 0%, hsl(210 12% 10% / 0.55) 50%, transparent 70%)",
      filter: "blur(60px)",
      animation: "theme-marble-drift 80s ease-in-out infinite",
    }} />

    {/* Subtle dusty teal pool */}
    <Blob style={{
      width: "60vw", height: "40vw",
      top: "35%", left: "25%",
      borderRadius: "50%",
      background: "radial-gradient(ellipse, hsl(195 18% 30% / 0.18) 0%, transparent 65%)",
      filter: "blur(35px)",
      animation: "theme-marble-drift 100s ease-in-out infinite 25s",
    }} />

    {/* Very faint vein — barely visible */}
    <Vein style={{
      width: "140%", height: "60px",
      top: "40%", left: "-20%",
      transform: "rotate(-4deg)",
      background: "linear-gradient(to right, transparent 0%, hsl(195 16% 40% / 0.06) 35%, hsl(195 16% 50% / 0.08) 52%, transparent 100%)",
      filter: "blur(8px)",
      animation: "theme-sunset-pulse 30s ease-in-out infinite 10s",
    }} />
  </>
);

// ─── Custom: user-uploaded image or animated GIF ──────────────────────────────

const CustomBg = () => {
  const [imgUrl, setImgUrl] = useState<string>(
    () => localStorage.getItem("customBackground") ?? ""
  );
  const [isActive, setIsActive] = useState<boolean>(
    () => localStorage.getItem("customBgActive") !== "false"
  );

  useEffect(() => {
    const handleUrl = () => setImgUrl(localStorage.getItem("customBackground") ?? "");
    const handleToggle = () => setIsActive(localStorage.getItem("customBgActive") !== "false");
    window.addEventListener("customBgUpdate", handleUrl);
    window.addEventListener("customBgToggle", handleToggle);
    return () => {
      window.removeEventListener("customBgUpdate", handleUrl);
      window.removeEventListener("customBgToggle", handleToggle);
    };
  }, []);

  if (!imgUrl || !isActive) return null;

  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `url(${imgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        opacity: 0.88,
      }}
    />
  );
};

// ─── Root component ────────────────────────────────────────────────────────────

const ThemeBackground = () => {
  const [themeId, setThemeId] = useState<string>(() => {
    // If focus mode is active, show focus bg
    if (localStorage.getItem("focus-mode") === "true") return "focus";
    // Resolve actual theme — "custom" just means custom bg is layered on top of default
    try {
      const saved = localStorage.getItem("customize-settings");
      if (saved) {
        const { background } = JSON.parse(saved);
        if (background && background !== "custom") return background;
      }
    } catch {
      // ignore
    }
    return document.documentElement.dataset.theme ?? "default";
  });

  const [focusActive, setFocusActive] = useState(
    () => localStorage.getItem("focus-mode") === "true"
  );

  useEffect(() => {
    const handler = () => {
      const raw = document.documentElement.dataset.theme ?? "default";
      // Map "custom" to "default" — custom bg is a layer, not a theme replacement
      setThemeId(raw === "custom" ? "default" : raw);
    };
    const focusHandler = () => {
      const isFocus = localStorage.getItem("focus-mode") === "true";
      setFocusActive(isFocus);
      if (isFocus) {
        setThemeId("focus");
      } else {
        // Restore theme from dataset
        const raw = document.documentElement.dataset.theme ?? "default";
        setThemeId(raw === "custom" ? "default" : raw);
      }
    };
    window.addEventListener("themechange", handler);
    window.addEventListener("focusmodechange", focusHandler);
    return () => {
      window.removeEventListener("themechange", handler);
      window.removeEventListener("focusmodechange", focusHandler);
    };
  }, []);

  return (
    <>
      {/* Theme-specific background — always renders */}
      {themeId === "default"  && <DefaultBg />}
      {themeId === "midnight" && <MidnightBg />}
      {themeId === "forest"   && <ForestBg />}
      {themeId === "sunset"   && <SunsetBg />}
      {themeId === "ocean"    && <OceanBg />}
      {themeId === "focus"    && <FocusBg />}
      {/* Custom image/GIF — layers on top of theme bg when set, hidden during focus */}
      {!focusActive && <CustomBg />}
    </>
  );
};

export default ThemeBackground;
