import { useState, useEffect } from "react";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const Blob = ({ style }: { style: React.CSSProperties }) => (
  <div className="absolute" style={{ pointerEvents: "none", ...style }} />
);

const Vein = ({ style }: { style: React.CSSProperties }) => (
  <div className="absolute" style={{ pointerEvents: "none", ...style }} />
);

// ─── Default: Abyssal Jade ─────────────────────────────────────────────────────
// Deep navy base with flowing teal and violet mineral currents.
const DefaultBg = () => (
  <>
    {/* Primary teal fluid mass */}
    <Blob style={{
      width: "150vw", height: "110vw",
      top: "-30%", left: "-30%",
      borderRadius: "42% 58% 55% 45% / 50% 44% 56% 50%",
      background: "radial-gradient(ellipse 55% 45% at 42% 48%, hsl(172 85% 30% / 0.75) 0%, hsl(195 70% 20% / 0.45) 48%, transparent 70%)",
      filter: "blur(50px)",
      animation: "theme-marble-drift 32s ease-in-out infinite",
    }} />

    {/* Violet depth pool */}
    <Blob style={{
      width: "120vw", height: "95vw",
      bottom: "-25%", right: "-25%",
      borderRadius: "55% 45% 42% 58% / 46% 54% 50% 50%",
      background: "radial-gradient(ellipse 52% 55% at 55% 48%, hsl(288 72% 38% / 0.70) 0%, hsl(265 55% 25% / 0.40) 50%, transparent 70%)",
      filter: "blur(60px)",
      animation: "theme-marble-drift 40s ease-in-out infinite reverse 8s",
    }} />

    {/* Bright teal luminous pool */}
    <Blob style={{
      width: "55vw", height: "35vw",
      top: "35%", left: "25%",
      borderRadius: "50%",
      background: "radial-gradient(ellipse, hsl(172 95% 55% / 0.28) 0%, transparent 65%)",
      filter: "blur(30px)",
      animation: "theme-marble-drift 56s ease-in-out infinite 15s",
    }} />

    {/* Teal vein */}
    <Vein style={{
      width: "160%", height: "100px",
      top: "26%", left: "-30%",
      transform: "rotate(-7deg)",
      background: "linear-gradient(to right, transparent 0%, hsl(172 90% 70% / 0.12) 30%, hsl(172 95% 82% / 0.20) 52%, hsl(172 90% 70% / 0.10) 74%, transparent 100%)",
      filter: "blur(6px)",
      animation: "theme-sunset-pulse 16s ease-in-out infinite 4s",
    }} />

    {/* Violet vein */}
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

// ─── Midnight: Amethyst Dream ──────────────────────────────────────────────────
// Deep indigo with violet and magenta crystal flows.
const MidnightBg = () => (
  <>
    {/* Primary amethyst mass */}
    <Blob style={{
      width: "145vw", height: "115vw",
      top: "-35%", right: "-28%",
      borderRadius: "46% 54% 50% 50% / 55% 45% 55% 45%",
      background: "radial-gradient(ellipse 50% 46% at 50% 46%, hsl(262 80% 38% / 0.72) 0%, hsl(240 60% 25% / 0.45) 50%, transparent 70%)",
      filter: "blur(55px)",
      animation: "theme-marble-drift 36s ease-in-out infinite",
    }} />

    {/* Magenta tendril */}
    <Blob style={{
      width: "105vw", height: "82vw",
      bottom: "-20%", left: "-20%",
      borderRadius: "52% 48% 45% 55% / 50% 55% 45% 50%",
      background: "radial-gradient(ellipse 55% 50% at 46% 50%, hsl(320 76% 38% / 0.65) 0%, hsl(308 55% 22% / 0.38) 50%, transparent 70%)",
      filter: "blur(58px)",
      animation: "theme-marble-drift 44s ease-in-out infinite reverse 10s",
    }} />

    {/* Bright violet shimmer */}
    <Blob style={{
      width: "55vw", height: "36vw",
      top: "34%", left: "22%",
      borderRadius: "50%",
      background: "radial-gradient(ellipse, hsl(262 90% 68% / 0.30) 0%, transparent 65%)",
      filter: "blur(28px)",
      animation: "theme-marble-drift 60s ease-in-out infinite 18s",
    }} />

    {/* Purple vein */}
    <Vein style={{
      width: "170%", height: "92px",
      top: "30%", left: "-35%",
      transform: "rotate(-9deg)",
      background: "linear-gradient(to right, transparent 0%, hsl(262 85% 75% / 0.14) 32%, hsl(262 90% 88% / 0.22) 52%, hsl(262 85% 75% / 0.11) 70%, transparent 100%)",
      filter: "blur(7px)",
      animation: "theme-sunset-pulse 18s ease-in-out infinite 5s",
    }} />

    {/* Magenta vein */}
    <Vein style={{
      width: "140%", height: "66px",
      bottom: "28%", right: "-22%",
      transform: "rotate(7deg)",
      background: "linear-gradient(to left, transparent 0%, hsl(320 82% 72% / 0.16) 35%, hsl(320 82% 84% / 0.13) 60%, transparent 100%)",
      filter: "blur(5px)",
      animation: "theme-sunset-pulse 25s ease-in-out infinite 9s",
    }} />
  </>
);

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

  useEffect(() => {
    const handler = () => setImgUrl(localStorage.getItem("customBackground") ?? "");
    window.addEventListener("customBgUpdate", handler);
    return () => window.removeEventListener("customBgUpdate", handler);
  }, []);

  if (!imgUrl) return null;

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
    try {
      const saved = localStorage.getItem("customize-settings");
      if (saved) {
        const { background } = JSON.parse(saved);
        if (background) return background;
      }
    } catch {
      // ignore
    }
    return document.documentElement.dataset.theme ?? "default";
  });

  useEffect(() => {
    const handler = () => {
      setThemeId(document.documentElement.dataset.theme ?? "default");
    };
    window.addEventListener("themechange", handler);
    return () => window.removeEventListener("themechange", handler);
  }, []);

  return (
    <>
      {themeId === "default"  && <DefaultBg />}
      {themeId === "midnight" && <MidnightBg />}
      {themeId === "forest"   && <ForestBg />}
      {themeId === "sunset"   && <SunsetBg />}
      {themeId === "ocean"    && <OceanBg />}
      {themeId === "focus"    && <FocusBg />}
      {themeId === "custom"   && <CustomBg />}
    </>
  );
};

export default ThemeBackground;
