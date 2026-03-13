export interface Theme {
  id: string;
  label: string;
  swatch: string;          // Flat colour (fallback)
  swatchGradient: string;  // Gradient for the theme button selector
  userBubble: string;      // Gradient for user chat messages
  aiBubble: string;        // Gradient for AI chat messages
  vars: Record<string, string>;
}

export const themes: Theme[] = [
  {
    id: "default",
    label: "Default",
    swatch: "hsl(175, 40%, 6%)",
    swatchGradient: "linear-gradient(135deg, hsl(172,88%,35%), hsl(220,70%,42%), hsl(270,55%,50%))",
    userBubble: "linear-gradient(135deg, hsl(172,88%,38%), hsl(200,60%,48%))",
    aiBubble: "linear-gradient(135deg, hsl(270,45%,38%), hsl(290,35%,44%))",
    vars: {
      "--background": "175 40% 6%",
      "--foreground": "0 0% 96%",
      "--card": "172 30% 15%",
      "--card-foreground": "0 0% 96%",
      "--popover": "172 30% 15%",
      "--popover-foreground": "0 0% 96%",
      "--secondary": "180 20% 65%",
      "--secondary-foreground": "0 0% 96%",
      "--muted": "172 25% 18%",
      "--muted-foreground": "0 0% 88%",
      "--accent": "270 55% 72%",
      "--accent-foreground": "0 0% 96%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "180 40% 22%",
      "--input": "180 25% 60%",
      "--primary": "185 60% 50%",
      "--primary-foreground": "175 40% 6%",
      "--ring": "185 60% 50%",
      "--glow-primary": "185 60% 50%",
      "--glow-accent": "270 55% 72%",
      "--surface-glass": "172 55% 20%",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    swatch: "hsl(240, 28%, 14%)",
    swatchGradient: "linear-gradient(135deg, hsl(262,85%,48%), hsl(320,80%,48%), hsl(280,70%,42%))",
    userBubble: "linear-gradient(135deg, hsl(262,80%,58%), hsl(290,70%,52%))",
    aiBubble: "linear-gradient(135deg, hsl(240,24%,22%), hsl(260,20%,20%))",
    vars: {
      "--background": "240 28% 14%",
      "--foreground": "240 15% 92%",
      "--card": "240 24% 20%",
      "--card-foreground": "240 15% 92%",
      "--popover": "240 24% 20%",
      "--popover-foreground": "240 15% 92%",
      "--secondary": "240 20% 28%",
      "--secondary-foreground": "240 15% 88%",
      "--muted": "240 20% 24%",
      "--muted-foreground": "240 20% 64%",
      "--accent": "320 80% 70%",
      "--accent-foreground": "240 15% 92%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "240 20% 32%",
      "--input": "240 20% 32%",
      "--primary": "262 85% 70%",
      "--primary-foreground": "240 28% 8%",
      "--ring": "262 85% 70%",
      "--glow-primary": "262 85% 70%",
      "--glow-accent": "320 80% 70%",
      "--surface-glass": "255 45% 22%",
    },
  },
  {
    id: "forest",
    label: "Forest",
    swatch: "hsl(160, 22%, 12%)",
    swatchGradient: "linear-gradient(135deg, hsl(138,78%,35%), hsl(82,78%,38%), hsl(155,60%,30%))",
    userBubble: "linear-gradient(135deg, hsl(138,72%,38%), hsl(155,65%,32%))",
    aiBubble: "linear-gradient(135deg, hsl(155,20%,18%), hsl(160,18%,15%))",
    vars: {
      "--background": "160 22% 12%",
      "--foreground": "155 20% 92%",
      "--card": "155 20% 18%",
      "--card-foreground": "155 20% 92%",
      "--popover": "155 20% 18%",
      "--popover-foreground": "155 20% 92%",
      "--secondary": "160 18% 24%",
      "--secondary-foreground": "155 18% 88%",
      "--muted": "160 18% 20%",
      "--muted-foreground": "155 20% 62%",
      "--accent": "82 78% 56%",
      "--accent-foreground": "155 20% 92%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "155 18% 28%",
      "--input": "155 18% 28%",
      "--primary": "138 78% 52%",
      "--primary-foreground": "160 22% 6%",
      "--ring": "138 78% 52%",
      "--glow-primary": "138 78% 52%",
      "--glow-accent": "82 78% 56%",
      "--surface-glass": "150 40% 18%",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    swatch: "hsl(15, 25%, 13%)",
    swatchGradient: "linear-gradient(135deg, hsl(28,95%,42%), hsl(350,82%,45%), hsl(15,80%,38%))",
    userBubble: "linear-gradient(135deg, hsl(28,90%,50%), hsl(350,75%,48%))",
    aiBubble: "linear-gradient(135deg, hsl(18,22%,19%), hsl(12,20%,16%))",
    vars: {
      "--background": "15 25% 13%",
      "--foreground": "20 15% 92%",
      "--card": "18 22% 19%",
      "--card-foreground": "20 15% 92%",
      "--popover": "18 22% 19%",
      "--popover-foreground": "20 15% 92%",
      "--secondary": "20 20% 26%",
      "--secondary-foreground": "20 18% 88%",
      "--muted": "15 20% 22%",
      "--muted-foreground": "20 20% 62%",
      "--accent": "350 82% 66%",
      "--accent-foreground": "20 15% 92%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "18 20% 30%",
      "--input": "18 20% 30%",
      "--primary": "28 95% 62%",
      "--primary-foreground": "15 25% 8%",
      "--ring": "28 95% 62%",
      "--glow-primary": "28 95% 62%",
      "--glow-accent": "350 82% 66%",
      "--surface-glass": "20 40% 20%",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    swatch: "hsl(200, 28%, 14%)",
    swatchGradient: "linear-gradient(135deg, hsl(200,88%,42%), hsl(175,82%,38%), hsl(210,70%,40%))",
    userBubble: "linear-gradient(135deg, hsl(200,82%,48%), hsl(180,75%,42%))",
    aiBubble: "linear-gradient(135deg, hsl(200,24%,20%), hsl(195,20%,17%))",
    vars: {
      "--background": "200 28% 14%",
      "--foreground": "200 15% 92%",
      "--card": "200 24% 20%",
      "--card-foreground": "200 15% 92%",
      "--popover": "200 24% 20%",
      "--popover-foreground": "200 15% 92%",
      "--secondary": "200 20% 28%",
      "--secondary-foreground": "200 18% 88%",
      "--muted": "200 20% 24%",
      "--muted-foreground": "200 20% 64%",
      "--accent": "175 82% 55%",
      "--accent-foreground": "200 15% 92%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "200 20% 32%",
      "--input": "200 20% 32%",
      "--primary": "200 88% 62%",
      "--primary-foreground": "200 28% 8%",
      "--ring": "200 88% 62%",
      "--glow-primary": "200 88% 62%",
      "--glow-accent": "175 82% 55%",
      "--surface-glass": "200 45% 20%",
    },
  },
  {
    id: "focus",
    label: "Focus",
    swatch: "hsl(210, 18%, 9%)",
    swatchGradient: "linear-gradient(135deg, hsl(210,16%,14%), hsl(195,18%,18%), hsl(210,14%,12%))",
    userBubble: "",  // Empty = no gradient, keep flat
    aiBubble: "",    // Empty = no gradient, keep flat
    vars: {
      "--background": "210 18% 9%",
      "--foreground": "200 15% 90%",
      "--card": "210 16% 12%",
      "--card-foreground": "200 15% 90%",
      "--popover": "210 16% 12%",
      "--popover-foreground": "200 15% 90%",
      "--secondary": "210 14% 18%",
      "--secondary-foreground": "200 12% 85%",
      "--muted": "210 14% 15%",
      "--muted-foreground": "210 12% 55%",
      "--accent": "195 16% 38%",
      "--accent-foreground": "200 15% 90%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "210 12% 22%",
      "--input": "210 12% 22%",
      "--primary": "195 20% 45%",
      "--primary-foreground": "210 18% 95%",
      "--ring": "195 20% 45%",
      "--glow-primary": "195 20% 45%",
      "--glow-accent": "195 16% 38%",
      "--surface-glass": "210 16% 12%",
    },
  },
];

export function applyTheme(id: string): void {
  const theme = themes.find((t) => t.id === id) ?? themes[0];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Set gradient CSS custom properties
  root.style.setProperty("--user-bubble-gradient", theme.userBubble || "none");
  root.style.setProperty("--ai-bubble-gradient", theme.aiBubble || "none");
  root.style.setProperty("--swatch-gradient", theme.swatchGradient || "none");

  // Always set the requested id so per-page CSS and CustomBg work
  root.dataset.theme = id;

  // Auto-persist: update the background field in customize-settings
  try {
    const raw = localStorage.getItem("customize-settings");
    const settings = raw ? JSON.parse(raw) : {};
    settings.background = id;
    localStorage.setItem("customize-settings", JSON.stringify(settings));
  } catch { /* ignore */ }

  window.dispatchEvent(new Event("themechange"));
}
