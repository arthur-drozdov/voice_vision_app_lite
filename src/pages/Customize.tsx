/**
 * Customize Page
 * 
 * Settings and customization panel including:
 * - Background/theme customization
 * - Voice cloning integration
 * - Audio settings
 * - Vision/camera settings
 * - Accessibility (Focus mode, Dyslexia font)
 * - Tone of Voice (dropdown)
 * 
 * NOTE: Character/AI personality selection is NOT on this page.
 * They belong to the Chat agent selection screen.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mic,
  Palette,
  Volume2,
  VolumeX,
  Camera,
  CameraOff,
  Save,
  RotateCcw,
  Upload,
  X,
  Accessibility,
  Moon,
  Sun,
  Contrast,
  SunDim,
  BellOff,
  Trash2,
  Download,
  Shield,
  ChevronRight,
} from "lucide-react";
import { VoiceCloningPanel } from "@/components/VoiceCloningPanel";
import { themes, applyTheme } from "@/lib/themes";
import { TONES, ToneId } from "@/lib/characterPrompts";
import GlassContainer from "@/components/GlassContainer";
import OrbitWrap from "@/components/OrbitWrap";
import { isFocusActive, toggleFocus } from "@/lib/FocusController";

import { wallpaperPresets, getSelectedWallpaper, setSelectedWallpaper } from "@/lib/wallpaperPresets";
import { midnightWallpaperPresets, getSelectedMidnightWallpaper, setSelectedMidnightWallpaper } from "@/lib/midnightWallpaperPresets";
import { sunsetWallpaperPresets, getSelectedSunsetWallpaper, setSelectedSunsetWallpaper } from "@/lib/sunsetWallpaperPresets";
import { sunsetV2WallpaperPresets, getSelectedSunsetV2Wallpaper, setSelectedSunsetV2Wallpaper } from "@/lib/sunsetV2WallpaperPresets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { trashCount, downloadBackup } from "@/lib/trashStore";


interface Settings {
  character: string;
  tone: ToneId;
  background: string;
  volume: number;
  isMuted: boolean;
  isCameraEnabled: boolean;
  selectedVoiceId: string | null;
}

const Customize = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [settings, setSettings] = useState<Settings>({
    character: "noe",
    tone: "warm",
    background: "default",
    volume: 80,
    isMuted: false,
    isCameraEnabled: true,
    selectedVoiceId: null,
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [customBgUrl, setCustomBgUrl] = useState<string>(
    () => localStorage.getItem("customBackground") ?? ""
  );
  const [customBgActive, setCustomBgActive] = useState(
    () => localStorage.getItem('customBgActive') !== 'false' && !!localStorage.getItem('customBackground')
  );
  const [focusMode, setFocusMode] = useState(isFocusActive);
  const [dyslexiaFont, setDyslexiaFont] = useState(
    () => localStorage.getItem("dyslexia-font") === "true"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialLoadRef = useRef(true);
  const [activeWp, setActiveWp] = useState(() =>
    document.documentElement.dataset.theme === "midnight"
      ? getSelectedMidnightWallpaper()
      : document.documentElement.dataset.theme === "sunset"
      ? getSelectedSunsetWallpaper()
      : getSelectedWallpaper()
  );
  // Accessibility states
  const [textScale, setTextScale] = useState(() => {
    const saved = localStorage.getItem("text-scale");
    return saved ? parseFloat(saved) : 1;
  });
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem("high-contrast") === "true"
  );
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem("brightness");
    return saved ? parseInt(saved) : 100;
  });
  const [quietNotifications, setQuietNotifications] = useState(
    () => localStorage.getItem("quiet-notifications") === "true"
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem("reduced-motion") === "true"
  );
  const [wideSpacing, setWideSpacing] = useState(
    () => localStorage.getItem("wide-spacing") === "true"
  );

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("customize-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
    // After initial load completes, allow future changes to mark dirty
    // Use a timeout to skip the initial settings hydration
    setTimeout(() => { initialLoadRef.current = false; }, 100);
  }, []);

  // Mark as dirty when settings change (skip initial load)
  useEffect(() => {
    if (initialLoadRef.current) return;
    setIsDirty(true);
  }, [settings]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-save immediately so theme persists across navigation
      try { localStorage.setItem("customize-settings", JSON.stringify(next)); } catch {}
      return next;
    });
    if (key === "background") {
      applyTheme(value as string);
      if (value === "custom") window.dispatchEvent(new Event("customBgUpdate"));
      // Sync wallpaper preset selection to the new theme
      if (value === "midnight") {
        setActiveWp(getSelectedMidnightWallpaper());
      } else if (value === "sunset") {
        setActiveWp(getSelectedSunsetWallpaper());
      } else {
        setActiveWp(getSelectedWallpaper());
      }
    }
  };

  // ── Custom image upload ───────────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isGif = file.type === "image/gif";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (isGif) {
        try {
          localStorage.setItem("customBackground", dataUrl);
          setCustomBgUrl(dataUrl);
          localStorage.setItem('customBgActive', 'true');
          setCustomBgActive(true);
          updateSetting("background", "custom");
          window.dispatchEvent(new Event("customBgUpdate"));
          window.dispatchEvent(new Event('customBgToggle'));
        } catch {
          toast({ title: "Image too large", description: "Please use a smaller GIF.", variant: "destructive" });
        }
      } else {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const r = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          const resized = canvas.toDataURL("image/jpeg", 0.85);
          try {
            localStorage.setItem("customBackground", resized);
            setCustomBgUrl(resized);
            localStorage.setItem('customBgActive', 'true');
            updateSetting("background", "custom");
            window.dispatchEvent(new Event("customBgUpdate"));
            window.dispatchEvent(new Event('customBgToggle'));
          } catch {
            toast({ title: "Image too large", description: "Please use a smaller image.", variant: "destructive" });
          }
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveCustomBg = () => {
    localStorage.removeItem("customBackground");
    setCustomBgUrl("");
    updateSetting("background", "default");
    window.dispatchEvent(new Event("customBgUpdate"));
  };

  // ── Accessibility toggles ──────────────────────────────────────────────────────
  const handleFocusToggle = () => {
    const newState = toggleFocus();
    setFocusMode(newState);
  };

  const handleDyslexiaToggle = (enabled: boolean) => {
    setDyslexiaFont(enabled);
    localStorage.setItem("dyslexia-font", String(enabled));
    document.body.classList.toggle("dyslexia-mode", enabled);
    // Recompute combined font-size multiplier
    const boost = enabled ? 1.25 : 1;
    const multiplier = textScale * boost;
    document.documentElement.style.setProperty("--font-size-multiplier", String(multiplier));
    document.documentElement.style.setProperty("--dyslexia-boost", String(boost));
  };

  // Restore accessibility settings on mount
  useEffect(() => {
    // Dyslexia mode on body
    const isDyslexia = dyslexiaFont;
    document.body.classList.toggle("dyslexia-mode", isDyslexia);
    // Text scale + combined multiplier
    const boost = isDyslexia ? 1.25 : 1;
    document.documentElement.style.setProperty("--text-scale", String(textScale));
    document.documentElement.style.setProperty("--dyslexia-boost", String(boost));
    document.documentElement.style.setProperty("--font-size-multiplier", String(textScale * boost));
    if (textScale > 1) document.documentElement.classList.add("large-text");
    // Brightness
    document.documentElement.style.setProperty("--brightness", String(brightness / 100));
    // Other modes
    if (highContrast) document.documentElement.classList.add("high-contrast-mode");
    if (quietNotifications) document.documentElement.classList.add("quiet-notifications");
  }, []);

  // ── New accessibility handlers ──────────────────────────────────────────────
  const applyTextScale = (scale: number) => {
    const clamped = Math.round(Math.max(0.85, Math.min(1.15, scale)) * 100) / 100;
    setTextScale(clamped);
    localStorage.setItem("text-scale", String(clamped));
    document.documentElement.style.setProperty("--text-scale", String(clamped));
    // Recompute combined font-size multiplier (include dyslexia boost if active)
    const boost = dyslexiaFont ? 1.25 : 1;
    document.documentElement.style.setProperty("--font-size-multiplier", String(clamped * boost));
    // Add extra spacing class when scaled up
    if (clamped > 1) {
      document.documentElement.classList.add("large-text");
    } else {
      document.documentElement.classList.remove("large-text");
    }
  };

  const handleTextScaleChange = (value: number[]) => {
    applyTextScale(value[0]);
  };

  const handleHighContrastToggle = (enabled: boolean) => {
    setHighContrast(enabled);
    localStorage.setItem("high-contrast", String(enabled));
    if (enabled) {
      document.documentElement.classList.add("high-contrast-mode");
    } else {
      document.documentElement.classList.remove("high-contrast-mode");
    }
  };

  const handleBrightnessChange = (value: number[]) => {
    const b = value[0];
    setBrightness(b);
    localStorage.setItem("brightness", String(b));
    document.documentElement.style.setProperty("--brightness", String(b / 100));
  };


  const handleQuietNotificationsToggle = (enabled: boolean) => {
    setQuietNotifications(enabled);
    localStorage.setItem("quiet-notifications", String(enabled));
    if (enabled) {
      document.documentElement.classList.add("quiet-notifications");
    } else {
      document.documentElement.classList.remove("quiet-notifications");
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem("customize-settings", JSON.stringify(settings));
      setIsDirty(false);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      const defaults: Settings = {
        character: "noe",
        tone: "warm",
        background: "default",
        volume: 80,
        isMuted: false,
        isCameraEnabled: true,
        selectedVoiceId: null,
      };
      setSettings(defaults);
      localStorage.setItem("customize-settings", JSON.stringify(defaults));
      localStorage.removeItem("customBackground");
      localStorage.setItem("customBgActive", "false");
      setCustomBgUrl("");
      setCustomBgActive(false);
      applyTheme("default");
      // Reset wallpaper to Signature
      setActiveWp("signature");
      setSelectedWallpaper("signature");
      window.dispatchEvent(new Event("customBgUpdate"));
      window.dispatchEvent(new Event("customBgToggle"));
      toast({
        title: "Settings Reset",
        description: "All settings have been reset to defaults.",
      });
    }
  };

  // Filter out Focus theme from the selector (it's activated via the toggle)
  const selectableThemes = themes.filter((t) => t.id !== "focus");

  return (
    <div className="flex flex-col h-full page-customize">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4">
        <OrbitWrap planet="neptune">
          <GlassContainer variant="dark" size="sm" className="flex flex-col">
            <h1 className="text-lg font-semibold text-foreground leading-tight">Customise</h1>
            <p className="text-xs text-muted-foreground">Theme, voice & accessibility</p>
          </GlassContainer>
        </OrbitWrap>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-5 pb-16 space-y-4">

        {/* Tone of Voice — Dropdown */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-base">🎙️</span>
              Tone of Voice
            </CardTitle>
            <CardDescription>How should your AI companion communicate?</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={settings.tone}
              onValueChange={(value) => updateSetting("tone", value as ToneId)}
            >
              <SelectTrigger className="w-full glass">
                <SelectValue placeholder="Select a tone" />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((tone) => (
                  <SelectItem key={tone.id} value={tone.id}>
                    <span className="flex items-center gap-2">
                      <span>{tone.emoji}</span>
                      <span className="font-medium">{tone.label}</span>
                      <span className="text-foreground/70 text-xs ml-1">— {tone.description}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Background Selection */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette size={16} className="text-primary" />
              Background
            </CardTitle>
            <CardDescription>Select a theme for your interface</CardDescription>
          </CardHeader>
          <CardContent className={`transition-opacity duration-300 ${focusMode ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="flex gap-3 flex-wrap justify-center">
              {selectableThemes.map((theme) => (
                <motion.button
                  key={theme.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateSetting("background", theme.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                    settings.background === theme.id
                      ? "ring-1 ring-primary"
                      : "hover:opacity-80"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full border transition-colors ${
                      settings.background === theme.id
                        ? "border-primary shadow-lg"
                        : "border-border"
                    }`}
                    style={{ background: theme.swatchGradient || theme.swatch }}
                  />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {theme.label}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Wallpaper presets — always visible for accent colour selection */}
            <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
              <p className="text-xs text-muted-foreground">
                {customBgActive
                  ? "Accent colour — tap to change button & UI colours"
                  : "Background preset — tap to preview"}
              </p>
              <div className={`grid gap-2 ${settings.background === "midnight" ? "grid-cols-4" : settings.background === "sunset" ? "grid-cols-6" : settings.background === "sunset-v2" ? "grid-cols-5" : "grid-cols-5"}`}>
                {(settings.background === "midnight" ? midnightWallpaperPresets : settings.background === "sunset" ? sunsetWallpaperPresets : settings.background === "sunset-v2" ? sunsetV2WallpaperPresets : wallpaperPresets).map((wp) => (
                  <button
                    key={wp.id}
                    onClick={() => {
                      setActiveWp(wp.id);
                      if (settings.background === "midnight") {
                        setSelectedMidnightWallpaper(wp.id);
                      } else if (settings.background === "sunset") {
                        setSelectedSunsetWallpaper(wp.id);
                      } else if (settings.background === "sunset-v2") {
                        setSelectedSunsetV2Wallpaper(wp.id);
                      } else {
                        setSelectedWallpaper(wp.id);
                      }
                      setIsDirty(true);
                      // If custom bg is NOT active, switch wallpaper normally
                      if (!customBgActive) {
                        localStorage.setItem('customBgActive', 'false');
                        window.dispatchEvent(new Event('customBgToggle'));
                      }
                    }}
                    className="relative rounded-lg overflow-hidden border transition-all duration-200"
                    style={{
                      aspectRatio: "1",
                      borderColor: activeWp === wp.id ? "hsl(var(--primary))" : "transparent",
                      boxShadow: activeWp === wp.id ? "0 0 10px hsl(var(--glow-primary) / 0.35)" : "none",
                    }}
                  >
                    {(wp.previewImage || wp.backgroundImage) ? (
                      <div className="absolute inset-0" style={{ backgroundImage: `url(${wp.previewImage || wp.backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                    ) : (
                      <>
                        <div className="absolute inset-0" style={{ background: wp.base }} />
                        {wp.layers?.slice(0, 1).map((layer, i) => (
                          <div key={i} className="absolute inset-0" style={{ background: layer.bg }} />
                        ))}
                      </>
                    )}
                    {/* Dark glass overlay for non-selected presets */}
                    {activeWp !== wp.id && (
                      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] font-semibold text-white leading-tight" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
                      {wp.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom image upload */}
            <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
              <p className="text-xs text-muted-foreground">Custom background (image or animated GIF)</p>

              {customBgUrl && (
                <div
                  className={`relative rounded-xl overflow-hidden transition-all h-24 ${
                    customBgActive ? "" : "opacity-50"
                  }`}
                  style={{
                    backgroundImage: `url(${customBgUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="absolute top-2 right-2" style={{ zIndex: 10 }}>
                    <button
                      onClick={handleRemoveCustomBg}
                      className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-600/60 hover:bg-red-600/75 transition-colors"
                      style={{ color: '#ffffff' }}
                    >
                      <X size={12} color="#ffffff" />
                    </button>
                  </div>
                  <button
                    className={`absolute bottom-2 left-2 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                      customBgActive
                        ? "bg-green-600/60 hover:bg-green-600/80"
                        : "bg-secondary/60 hover:bg-secondary/80"
                    }`}
                    style={{ color: '#ffffff', zIndex: 10 }}
                    onClick={() => {
                      const next = !customBgActive;
                      setCustomBgActive(next);
                      localStorage.setItem('customBgActive', next ? 'true' : 'false');
                      window.dispatchEvent(new Event('customBgToggle'));
                      setIsDirty(true);
                    }}
                  >
                    {customBgActive ? 'Active' : 'Deactivated'}
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl bg-secondary/50 border border-border/70 flex items-center justify-center gap-2 hover:bg-secondary/70 transition-colors"
              >
                <Upload size={15} className="text-white" />
                <span className="text-xs text-white font-medium">
                  {customBgUrl ? "Replace image / GIF" : "Upload image or GIF"}
                </span>
              </motion.button>
            </div>
          </CardContent>
        </Card>

        {/* Accessibility Section */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Accessibility size={16} className="text-primary" />
              Accessibility
            </CardTitle>
            <CardDescription>Comfort and readability settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Focus / Calm Mode toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {focusMode ? (
                  <Moon size={18} className="text-primary" />
                ) : (
                  <Sun size={18} className="text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">Focus Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {focusMode
                      ? "Calm theme active — reduced motion & simplified UI"
                      : "Enable for a calmer, low-stimulation experience"}
                  </p>
                </div>
              </div>
              <Switch
                checked={focusMode}
                onCheckedChange={handleFocusToggle}
              />
            </div>

            {/* Dyslexia font toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔤</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Dyslexia-Friendly Font</p>
                  <p className="text-xs text-muted-foreground">
                    {dyslexiaFont
                      ? "OpenDyslexic font active"
                      : "Use a more readable font for dyslexia"}
                  </p>
                </div>
              </div>
              <Switch
                checked={dyslexiaFont}
                onCheckedChange={handleDyslexiaToggle}
              />
            </div>
          </CardContent>
        </Card>
        {/* Display & Comfort Settings */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <SunDim size={16} className="text-primary" />
              Display & Comfort
            </CardTitle>
            <CardDescription>Adjust visual intensity and readability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Text Size slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Text Size</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">A</span>
                  <div className="w-32">
                    <Slider
                      value={[textScale]}
                      onValueChange={handleTextScaleChange}
                      min={0.85}
                      max={1.15}
                      step={0.01}
                      className="w-full"
                      aria-label="Text size"
                    />
                  </div>
                  <span className="text-base text-muted-foreground font-medium">A</span>
                </div>
              </div>
            </div>

            {/* Brightness slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SunDim size={18} className="text-muted-foreground" />
                  <Label className="text-sm font-medium text-foreground">Brightness</Label>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {brightness}%
                </span>
              </div>
              <Slider
                value={[brightness]}
                onValueChange={handleBrightnessChange}
                min={50}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Lower brightness for a calmer experience</p>
            </div>

            {/* High Contrast toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Contrast size={18} className={highContrast ? "text-primary" : "text-muted-foreground"} />
                <div>
                  <p className="text-sm font-medium text-foreground">High Contrast</p>
                  <p className="text-xs text-muted-foreground">
                    {highContrast
                      ? "Maximum contrast active"
                      : "Increase text and border contrast"}
                  </p>
                </div>
              </div>
              <Switch
                checked={highContrast}
                onCheckedChange={handleHighContrastToggle}
              />
            </div>

            {/* Reduced Motion toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎞️</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Reduced Motion</p>
                  <p className="text-xs text-muted-foreground">
                    {reducedMotion
                      ? "Animations minimized"
                      : "Disable animations for comfort"}
                  </p>
                </div>
              </div>
              <Switch
                checked={reducedMotion}
                onCheckedChange={(enabled) => {
                  setReducedMotion(enabled);
                  localStorage.setItem("reduced-motion", String(enabled));
                  document.documentElement.classList.toggle("reduce-motion", enabled);
                }}
              />
            </div>

            {/* Increased Line Spacing toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">↕️</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Increased Line Spacing</p>
                  <p className="text-xs text-muted-foreground">
                    {wideSpacing
                      ? "Extra spacing active"
                      : "More space between lines for readability"}
                  </p>
                </div>
              </div>
              <Switch
                checked={wideSpacing}
                onCheckedChange={(enabled) => {
                  setWideSpacing(enabled);
                  localStorage.setItem("wide-spacing", String(enabled));
                  document.documentElement.classList.toggle("wide-spacing", enabled);
                }}
              />
            </div>


            {/* Quiet Notifications toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellOff size={18} className={quietNotifications ? "text-primary" : "text-muted-foreground"} />
                <div>
                  <p className="text-sm font-medium text-foreground">Quiet Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {quietNotifications
                      ? "Notifications are subdued"
                      : "Reduce notification visual intensity"}
                  </p>
                </div>
              </div>
              <Switch
                checked={quietNotifications}
                onCheckedChange={handleQuietNotificationsToggle}
              />
            </div>
          </CardContent>
        </Card>

        {/* Voice Cloning Section */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic size={16} className="text-primary" />
              Voice Cloning
            </CardTitle>
            <CardDescription>Create and manage voice clones</CardDescription>
          </CardHeader>
          <CardContent>
            <VoiceCloningPanel
              compact
              selectedVoiceId={settings.selectedVoiceId}
              onVoiceSelect={(voiceId) => updateSetting("selectedVoiceId", voiceId)}
            />
          </CardContent>
        </Card>

        {/* Audio Settings */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Volume2 size={16} className="text-primary" />
              Audio Settings
            </CardTitle>
            <CardDescription>Configure audio playback</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mute toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {settings.isMuted ? (
                  <VolumeX size={18} className="text-muted-foreground" />
                ) : (
                  <Volume2 size={18} className="text-primary" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">Mute All Sound</p>
                  <p className="text-xs text-muted-foreground">
                    {settings.isMuted ? "Sound is muted" : "Sound is enabled"}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.isMuted}
                onCheckedChange={(checked) => updateSetting("isMuted", checked)}
              />
            </div>

            {/* Volume slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Volume</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {settings.isMuted ? 0 : settings.volume}%
                </span>
              </div>
              <Slider
                value={[settings.isMuted ? 0 : settings.volume]}
                onValueChange={([value]) => updateSetting("volume", value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Vision/Camera Settings */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {settings.isCameraEnabled ? (
                <Camera size={16} className="text-primary" />
              ) : (
                <CameraOff size={16} className="text-muted-foreground" />
              )}
              Vision Settings
            </CardTitle>
            <CardDescription>Control camera access</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {settings.isCameraEnabled ? (
                  <Camera size={18} className="text-primary" />
                ) : (
                  <CameraOff size={18} className="text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">Camera Access</p>
                  <p className="text-xs text-muted-foreground">
                    {settings.isCameraEnabled
                      ? "Camera is enabled for vision features"
                      : "Camera is disabled"}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.isCameraEnabled}
                onCheckedChange={(checked) => updateSetting("isCameraEnabled", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Data & Backup */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield size={16} className="text-primary" />
              Data & Backup
            </CardTitle>
            <CardDescription>Manage your data and recover deleted items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => navigate("/recently-deleted")}
              className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/5 transition-colors text-left"
            >
              <Trash2 size={18} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Recently Deleted</p>
                <p className="text-xs text-muted-foreground">
                  {trashCount() > 0
                    ? `${trashCount()} item${trashCount() !== 1 ? "s" : ""} · 30-day recovery`
                    : "Trash is empty"}
                </p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </button>
            <button
              onClick={() => navigate("/memory-sanctuary")}
              className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/5 transition-colors text-left"
            >
              <Shield size={18} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Memory Sanctuary</p>
                <p className="text-xs text-muted-foreground">Manage what your AI remembers</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </button>
            <button
              onClick={downloadBackup}
              className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/5 transition-colors text-left"
            >
              <Download size={18} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Download Backup</p>
                <p className="text-xs text-muted-foreground">Export all chats, boards & settings as JSON</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </button>

            {/* Reset Settings */}
            <button
              onClick={handleReset}
              className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/5 transition-colors text-left"
            >
              <RotateCcw size={18} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Reset Settings</p>
                <p className="text-xs text-muted-foreground">Restores tone, theme, background &amp; accessibility to defaults</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Bottom action buttons — kept for reference, removed from view
      <div className="sticky bottom-16 px-5 pb-4 pt-2 border-t border-border/50" style={{ background: "hsl(var(--background) / 0.95)" }}>
        <div className="flex gap-2 max-w-lg mx-auto">
          <Button
            onClick={handleReset}
            variant="outline"
            className="flex-1"
            size="sm"
            style={{
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--foreground))",
              background: "hsl(var(--surface-glass) / 0.5)",
            }}
          >
            <RotateCcw size={16} className="mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty && saveStatus === "idle"}
            className="flex-1 transition-all duration-300 font-semibold"
            size="sm"
            style={
              saveStatus === "success"
                ? { background: "hsl(142, 72%, 55%)", color: "white", border: "none", opacity: 1, boxShadow: "0 0 12px hsla(142, 80%, 55%, 0.4)" }
                : saveStatus === "error"
                ? { background: "hsl(0, 70%, 50%)", color: "#fff", border: "none" }
                : isDirty
                ? { background: "hsl(var(--primary))", color: "#fff", border: "none", boxShadow: "0 0 14px hsl(var(--primary) / 0.45)" }
                : {}
            }
          >
            {saveStatus === "success" ? (
              "All good 👍"
            ) : saveStatus === "error" ? (
              "Please try again"
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
      */}
    </div>
  );
};

export default Customize;
