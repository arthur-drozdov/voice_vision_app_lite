import { describe, it, expect, beforeEach, vi } from "vitest";
import { enableFocus, disableFocus, isFocusActive, toggleFocus } from "@/lib/FocusController";

// Mock applyTheme since it manipulates the real DOM
vi.mock("@/lib/themes", () => ({
  applyTheme: vi.fn(),
}));

// Mock BackgroundManager
vi.mock("@/lib/BackgroundManager", () => ({
  setFocusActive: vi.fn(),
}));

describe("FocusController", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("focus-mode");
    vi.clearAllMocks();
  });

  it("isFocusActive returns false by default", () => {
    expect(isFocusActive()).toBe(false);
  });

  it("enableFocus sets localStorage and adds CSS class", () => {
    enableFocus();
    expect(localStorage.getItem("focus-mode")).toBe("true");
    expect(document.documentElement.classList.contains("focus-mode")).toBe(true);
  });

  it("isFocusActive returns true after enableFocus", () => {
    enableFocus();
    expect(isFocusActive()).toBe(true);
  });

  it("disableFocus removes localStorage and CSS class", () => {
    enableFocus();
    disableFocus();
    expect(localStorage.getItem("focus-mode")).toBeNull();
    expect(document.documentElement.classList.contains("focus-mode")).toBe(false);
  });

  it("enableFocus saves previous theme before switching", () => {
    // Set up a "current theme" in settings
    localStorage.setItem(
      "customize-settings",
      JSON.stringify({ background: "midnight" })
    );

    enableFocus();

    expect(localStorage.getItem("focus-prev-theme")).toBe("midnight");
  });

  it("disableFocus restores previous theme", () => {
    localStorage.setItem(
      "customize-settings",
      JSON.stringify({ background: "forest" })
    );

    enableFocus();
    disableFocus();

    // Previous theme should be cleaned up after restore
    expect(localStorage.getItem("focus-prev-theme")).toBeNull();
  });

  it("toggleFocus toggles between on and off", () => {
    const firstResult = toggleFocus();
    expect(firstResult).toBe(true);
    expect(isFocusActive()).toBe(true);

    const secondResult = toggleFocus();
    expect(secondResult).toBe(false);
    expect(isFocusActive()).toBe(false);
  });

  it("enableFocus dispatches focusmodechange event", () => {
    const handler = vi.fn();
    window.addEventListener("focusmodechange", handler);

    enableFocus();
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener("focusmodechange", handler);
  });

  it("disableFocus dispatches focusmodechange event", () => {
    enableFocus();
    const handler = vi.fn();
    window.addEventListener("focusmodechange", handler);

    disableFocus();
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener("focusmodechange", handler);
  });
});
