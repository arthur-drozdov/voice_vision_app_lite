/**
 * BackgroundManager — Global store for background state.
 *
 * Priority:
 *   1. Focus mode → show Focus background
 *   2. Custom background → show user-uploaded image/GIF
 *   3. Theme background → show theme's fluid-art bg
 *
 * Uses a simple event-driven pattern so any component can subscribe.
 */

export type BackgroundMode = "focus" | "custom" | "theme";

interface BackgroundState {
  mode: BackgroundMode;
  themeId: string;
  customUrl: string | null;
  focusActive: boolean;
}

type Listener = (state: BackgroundState) => void;

const listeners = new Set<Listener>();

let state: BackgroundState = {
  mode: "theme",
  themeId: "default",
  customUrl: null,
  focusActive: false,
};

function resolveMode(s: BackgroundState): BackgroundMode {
  if (s.focusActive) return "focus";
  if (s.customUrl) return "custom";
  return "theme";
}

function notify() {
  listeners.forEach((fn) => fn(state));
  window.dispatchEvent(new CustomEvent("backgroundchange", { detail: state }));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getBackgroundState(): Readonly<BackgroundState> {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setThemeId(themeId: string) {
  state = { ...state, themeId, mode: resolveMode({ ...state, themeId }) };
  notify();
}

export function setCustomBackground(url: string | null) {
  state = { ...state, customUrl: url, mode: resolveMode({ ...state, customUrl: url }) };
  notify();
}

export function setFocusActive(active: boolean) {
  state = { ...state, focusActive: active, mode: resolveMode({ ...state, focusActive: active }) };
  notify();
}

/** Initialise from localStorage on app boot. */
export function initFromStorage() {
  try {
    const saved = localStorage.getItem("customize-settings");
    if (saved) {
      const { background } = JSON.parse(saved);
      if (background && background !== "custom") {
        state.themeId = background;
      }
    }
    const customBg = localStorage.getItem("customBackground");
    if (customBg) {
      state.customUrl = customBg;
    }
    const focusState = localStorage.getItem("focus-mode");
    if (focusState === "true") {
      state.focusActive = true;
    }
    state.mode = resolveMode(state);
  } catch {
    // ignore
  }
}
