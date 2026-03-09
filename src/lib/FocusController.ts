/**
 * FocusController — Manages Focus/Calm mode.
 *
 * When enabled:
 *   1. Saves previousTheme + previousBackground to localStorage
 *   2. Applies the "focus" theme (dark, low-saturation)
 *   3. Adds `.focus-mode` class to documentElement (triggers reduced-motion CSS)
 *   4. Dispatches a 'focusmodechange' event for UI subscribers
 *
 * When disabled:
 *   Restores the saved theme + background exactly.
 */

import { applyTheme } from "@/lib/themes";
import { setFocusActive } from "@/lib/BackgroundManager";

const FOCUS_KEY = "focus-mode";
const FOCUS_PREV_THEME_KEY = "focus-prev-theme";
const FOCUS_PREV_BG_KEY = "focus-prev-background";

/** Check if Focus mode is currently active. */
export function isFocusActive(): boolean {
  return localStorage.getItem(FOCUS_KEY) === "true";
}

/** Enable Focus/Calm mode. */
export function enableFocus(): void {
  // 1. Save current theme + background
  try {
    const settings = localStorage.getItem("customize-settings");
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.background) {
        localStorage.setItem(FOCUS_PREV_THEME_KEY, parsed.background);
      }
    }
    const customBg = localStorage.getItem("customBackground");
    if (customBg) {
      localStorage.setItem(FOCUS_PREV_BG_KEY, customBg);
    }
  } catch {
    // continue even if saving previous state fails
  }

  // 2. Activate focus mode
  localStorage.setItem(FOCUS_KEY, "true");

  // 3. Apply focus theme
  applyTheme("focus");

  // 4. Add reduced-motion class
  document.documentElement.classList.add("focus-mode");

  // 5. Update BackgroundManager
  setFocusActive(true);

  // 6. Dispatch event
  window.dispatchEvent(new Event("focusmodechange"));
}

/** Disable Focus/Calm mode — restore previous theme/background. */
export function disableFocus(): void {
  // 1. Remove focus state
  localStorage.removeItem(FOCUS_KEY);
  document.documentElement.classList.remove("focus-mode");

  // 2. Restore previous theme
  const prevTheme = localStorage.getItem(FOCUS_PREV_THEME_KEY) || "default";
  applyTheme(prevTheme);

  // 3. Restore previous background in settings
  try {
    const settings = localStorage.getItem("customize-settings");
    const parsed = settings ? JSON.parse(settings) : {};
    parsed.background = prevTheme;
    localStorage.setItem("customize-settings", JSON.stringify(parsed));
  } catch {
    // ignore
  }

  // 4. Restore custom background if it was set
  const prevBg = localStorage.getItem(FOCUS_PREV_BG_KEY);
  if (prevBg && prevTheme === "custom") {
    localStorage.setItem("customBackground", prevBg);
    window.dispatchEvent(new Event("customBgUpdate"));
  }

  // 5. Clean up stored previous state
  localStorage.removeItem(FOCUS_PREV_THEME_KEY);
  localStorage.removeItem(FOCUS_PREV_BG_KEY);

  // 6. Update BackgroundManager
  setFocusActive(false);

  // 7. Dispatch event
  window.dispatchEvent(new Event("focusmodechange"));
}

/** Toggle Focus mode on/off. Returns the new state. */
export function toggleFocus(): boolean {
  if (isFocusActive()) {
    disableFocus();
    return false;
  } else {
    enableFocus();
    return true;
  }
}
