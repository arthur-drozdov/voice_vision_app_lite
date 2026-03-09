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
import { isFocusActive, toggleFocus } from "@/lib/FocusController";
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
    character: "kai",
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
  const [focusMode, setFocusMode] = useState(isFocusActive);
  const [dyslexiaFont, setDyslexiaFont] = useState(
    () => localStorage.getItem("dyslexia-font") === "true"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialLoadRef = useRef(true);

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
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (key === "background") {
      applyTheme(value as string);
      if (value === "custom") window.dispatchEvent(new Event("customBgUpdate"));
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
          updateSetting("background", "custom");
          window.dispatchEvent(new Event("customBgUpdate"));
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
            updateSetting("background", "custom");
            window.dispatchEvent(new Event("customBgUpdate"));
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
      setSettings({
        character: "kai",
        tone: "warm",
        background: "default",
        volume: 80,
        isMuted: false,
        isCameraEnabled: true,
        selectedVoiceId: null,
      });
      localStorage.removeItem("customize-settings");
      localStorage.removeItem("customBackground");
      setCustomBgUrl("");
      applyTheme("default");
      window.dispatchEvent(new Event("customBgUpdate"));
      toast({
        title: "Settings Reset",
        description: "All settings have been reset to defaults.",
      });
    }
  };

  // Filter out Focus theme from the selector (it's activated via the toggle)
  const selectableThemes = themes.filter((t) => t.id !== "focus");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4">
        <GlassContainer variant="dark" size="sm" className="flex flex-col">
          <h1 className="text-lg font-semibold text-foreground leading-tight">Customise</h1>
          <p className="text-xs text-muted-foreground">Theme, voice & accessibility</p>
        </GlassContainer>
        <div className="flex items-center gap-2">
          {isDirty && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <GlassContainer variant="dark" size="sm" className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] text-muted-foreground">Unsaved</span>
              </GlassContainer>
            </motion.div>
          )}
          {!isDirty && saveStatus === "idle" && (
            <GlassContainer variant="dark" size="sm" className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[10px] text-muted-foreground">Saved</span>
            </GlassContainer>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-5 pb-32 space-y-4">

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
                      <span className="text-muted-foreground text-xs ml-1">— {tone.description}</span>
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
          <CardContent>
            <div className="flex gap-3 flex-wrap justify-center">
              {selectableThemes.map((theme) => (
                <motion.button
                  key={theme.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateSetting("background", theme.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                    settings.background === theme.id
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "hover:opacity-80"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl border-2 transition-colors ${
                      settings.background === theme.id
                        ? "border-primary shadow-lg"
                        : "border-border"
                    }`}
                    style={{ backgroundColor: theme.swatch }}
                  />
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {theme.label}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Custom image upload */}
            <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
              <p className="text-xs text-muted-foreground">Custom background (image or animated GIF)</p>

              {customBgUrl && (
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={customBgUrl}
                    alt="Custom background preview"
                    className={`w-full h-24 object-cover transition-all ${
                      settings.background === "custom" ? "opacity-100 ring-2 ring-primary" : "opacity-50"
                    }`}
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {settings.background !== "custom" && (
                      <button
                        onClick={() => updateSetting("background", "custom")}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium glass text-primary"
                      >
                        Apply
                      </button>
                    )}
                    <button
                      onClick={handleRemoveCustomBg}
                      className="p-1.5 rounded-lg bg-destructive/30 hover:bg-destructive/60 transition-colors"
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                  {settings.background === "custom" && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg glass text-[10px] text-primary font-medium">
                      Active
                    </div>
                  )}
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
                className="w-full py-3 rounded-xl glass border border-dashed border-border/70 flex items-center justify-center gap-2 hover:border-primary/50 transition-colors"
              >
                <Upload size={15} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
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
          </CardContent>
        </Card>
      </div>

      {/* Bottom action buttons */}
      <div className="sticky bottom-16 px-5 pb-4 pt-2 glass border-t border-border/50">
        <div className="flex gap-2 max-w-lg mx-auto">
          <Button
            onClick={handleReset}
            variant="outline"
            className="flex-1"
            size="sm"
          >
            <RotateCcw size={16} className="mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={(!isDirty && saveStatus === "idle") || saveStatus === "success"}
            className={`flex-1 transition-all duration-300 ${
              saveStatus === "success"
                ? "!bg-green-500 hover:!bg-green-500 !text-white"
                : saveStatus === "error"
                ? "!bg-destructive hover:!bg-destructive"
                : ""
            }`}
            size="sm"
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
    </div>
  );
};

export default Customize;
