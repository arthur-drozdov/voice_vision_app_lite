import { describe, it, expect, beforeEach } from "vitest";
import {
  getBackgroundState,
  setThemeId,
  setCustomBackground,
  setFocusActive,
  initFromStorage,
} from "@/lib/BackgroundManager";

describe("BackgroundManager", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset to defaults
    setFocusActive(false);
    setCustomBackground(null);
    setThemeId("default");
  });

  it("defaults to theme mode with default theme", () => {
    const state = getBackgroundState();
    expect(state.mode).toBe("theme");
    expect(state.themeId).toBe("default");
    expect(state.customUrl).toBeNull();
    expect(state.focusActive).toBe(false);
  });

  it("setThemeId updates the theme and stays in theme mode", () => {
    setThemeId("midnight");
    const state = getBackgroundState();
    expect(state.themeId).toBe("midnight");
    expect(state.mode).toBe("theme");
  });

  it("setCustomBackground switches to custom mode", () => {
    setCustomBackground("data:image/png;base64,abc");
    const state = getBackgroundState();
    expect(state.mode).toBe("custom");
    expect(state.customUrl).toBe("data:image/png;base64,abc");
  });

  it("setFocusActive overrides custom mode with focus", () => {
    setCustomBackground("data:image/png;base64,abc");
    setFocusActive(true);
    const state = getBackgroundState();
    expect(state.mode).toBe("focus");
    expect(state.focusActive).toBe(true);
    // custom is still stored
    expect(state.customUrl).toBe("data:image/png;base64,abc");
  });

  it("disabling focus restores custom mode if custom bg exists", () => {
    setCustomBackground("data:image/png;base64,abc");
    setFocusActive(true);
    expect(getBackgroundState().mode).toBe("focus");

    setFocusActive(false);
    expect(getBackgroundState().mode).toBe("custom");
  });

  it("clearing custom background returns to theme mode", () => {
    setCustomBackground("data:image/png;base64,abc");
    expect(getBackgroundState().mode).toBe("custom");

    setCustomBackground(null);
    expect(getBackgroundState().mode).toBe("theme");
  });

  it("priority is focus > custom > theme", () => {
    setThemeId("ocean");
    expect(getBackgroundState().mode).toBe("theme");

    setCustomBackground("some-url");
    expect(getBackgroundState().mode).toBe("custom");

    setFocusActive(true);
    expect(getBackgroundState().mode).toBe("focus");
  });

  it("initFromStorage loads settings from localStorage", () => {
    localStorage.setItem(
      "customize-settings",
      JSON.stringify({ background: "forest" })
    );
    localStorage.setItem("customBackground", "data:image/gif;base64,xyz");

    initFromStorage();
    const state = getBackgroundState();
    expect(state.themeId).toBe("forest");
    expect(state.customUrl).toBe("data:image/gif;base64,xyz");
    expect(state.mode).toBe("custom"); // custom takes priority over theme
  });

  it("initFromStorage handles focus-mode from localStorage", () => {
    localStorage.setItem("focus-mode", "true");
    initFromStorage();
    expect(getBackgroundState().mode).toBe("focus");
  });
});
