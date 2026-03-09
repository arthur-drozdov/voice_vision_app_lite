export interface Theme {
  id: string;
  label: string;
  swatch: string;
  vars: Record<string, string>;
}

export const themes: Theme[] = [
  {
    id: "default",
    label: "Default",
    swatch: "hsl(225, 22%, 15%)",
    vars: {
      "--background": "225 22% 15%",
      "--card": "225 20% 22%",
      "--popover": "225 20% 22%",
      "--secondary": "225 18% 28%",
      "--muted": "225 18% 24%",
      "--muted-foreground": "215 22% 64%",
      "--border": "225 18% 32%",
      "--input": "225 18% 32%",
      "--primary": "172 90% 52%",
      "--primary-foreground": "225 22% 8%",
      "--accent": "290 78% 68%",
      "--ring": "172 90% 52%",
      "--glow-primary": "172 90% 52%",
      "--glow-accent": "290 78% 68%",
      "--surface-glass": "225 20% 22%",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    swatch: "hsl(240, 28%, 14%)",
    vars: {
      "--background": "240 28% 14%",
      "--card": "240 24% 20%",
      "--popover": "240 24% 20%",
      "--secondary": "240 20% 28%",
      "--muted": "240 20% 24%",
      "--muted-foreground": "240 20% 64%",
      "--border": "240 20% 32%",
      "--input": "240 20% 32%",
      "--primary": "262 85% 70%",
      "--primary-foreground": "240 28% 8%",
      "--accent": "320 80% 70%",
      "--ring": "262 85% 70%",
      "--glow-primary": "262 85% 70%",
      "--glow-accent": "320 80% 70%",
      "--surface-glass": "240 24% 20%",
    },
  },
  {
    id: "forest",
    label: "Forest",
    swatch: "hsl(160, 22%, 12%)",
    vars: {
      "--background": "160 22% 12%",
      "--card": "155 20% 18%",
      "--popover": "155 20% 18%",
      "--secondary": "160 18% 24%",
      "--muted": "160 18% 20%",
      "--muted-foreground": "155 20% 62%",
      "--border": "155 18% 28%",
      "--input": "155 18% 28%",
      "--primary": "138 78% 52%",
      "--primary-foreground": "160 22% 6%",
      "--accent": "82 78% 56%",
      "--ring": "138 78% 52%",
      "--glow-primary": "138 78% 52%",
      "--glow-accent": "82 78% 56%",
      "--surface-glass": "155 20% 18%",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    swatch: "hsl(15, 25%, 13%)",
    vars: {
      "--background": "15 25% 13%",
      "--card": "18 22% 19%",
      "--popover": "18 22% 19%",
      "--secondary": "20 20% 26%",
      "--muted": "15 20% 22%",
      "--muted-foreground": "20 20% 62%",
      "--border": "18 20% 30%",
      "--input": "18 20% 30%",
      "--primary": "28 95% 62%",
      "--primary-foreground": "15 25% 8%",
      "--accent": "350 82% 66%",
      "--ring": "28 95% 62%",
      "--glow-primary": "28 95% 62%",
      "--glow-accent": "350 82% 66%",
      "--surface-glass": "18 22% 19%",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    swatch: "hsl(200, 28%, 14%)",
    vars: {
      "--background": "200 28% 14%",
      "--card": "200 24% 20%",
      "--popover": "200 24% 20%",
      "--secondary": "200 20% 28%",
      "--muted": "200 20% 24%",
      "--muted-foreground": "200 20% 64%",
      "--border": "200 20% 32%",
      "--input": "200 20% 32%",
      "--primary": "200 88% 62%",
      "--primary-foreground": "200 28% 8%",
      "--accent": "175 82% 55%",
      "--ring": "200 88% 62%",
      "--glow-primary": "200 88% 62%",
      "--glow-accent": "175 82% 55%",
      "--surface-glass": "200 24% 20%",
    },
  },
  {
    id: "focus",
    label: "Focus",
    swatch: "hsl(210, 18%, 9%)",
    vars: {
      "--background": "210 18% 9%",
      "--card": "210 16% 12%",
      "--popover": "210 16% 12%",
      "--secondary": "210 14% 18%",
      "--muted": "210 14% 15%",
      "--muted-foreground": "210 12% 55%",
      "--border": "210 12% 22%",
      "--input": "210 12% 22%",
      "--primary": "195 20% 45%",
      "--primary-foreground": "210 18% 95%",
      "--accent": "195 16% 38%",
      "--ring": "195 20% 45%",
      "--glow-primary": "195 20% 45%",
      "--glow-accent": "195 16% 38%",
      "--surface-glass": "210 16% 12%",
      "--foreground": "200 15% 90%",
    },
  },
];

export function applyTheme(id: string): void {
  const theme = themes.find((t) => t.id === id) ?? themes[0];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  // Always set the requested id (even if vars fell back to default) so CustomBg works
  root.dataset.theme = id;
  window.dispatchEvent(new Event("themechange"));
}
