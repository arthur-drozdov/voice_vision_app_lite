/**
 * OrbitWrap — Wraps a header panel with a planet orbiting its border.
 *
 * Uses CSS offset-path to trace the exact rounded-rectangle perimeter
 * of the child GlassContainer. The planet follows the card's border line —
 * not inside, not outside, but right ON it.
 *
 * Only visible on Midnight / Sunset themes.
 *
 * Usage:
 *   <OrbitWrap planet="earth">
 *     <GlassContainer ...>header content</GlassContainer>
 *   </OrbitWrap>
 */

import React, { useRef, useEffect, useState, useCallback } from "react";

export type PlanetName = "earth" | "saturn" | "venus" | "jupiter" | "neptune";

/* Per-planet orbit config */
const ORBIT_CFG: Record<PlanetName, { dur: number; ccw: boolean }> = {
  earth:   { dur: 12, ccw: false },
  saturn:  { dur: 18, ccw: false },
  venus:   { dur: 10, ccw: true  },
  jupiter: { dur: 8,  ccw: false },
  neptune: { dur: 25, ccw: false },
};

function isOrbitTheme(): boolean {
  const t = document.documentElement.dataset.theme;
  return t === "midnight" || t === "sunset";
}

// Inject offset-distance keyframes once globally
let keyframesInjected = false;
function ensureKeyframes() {
  if (keyframesInjected) return;
  keyframesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes orbitPathCW {
      from { offset-distance: 0%; }
      to   { offset-distance: 100%; }
    }
    @keyframes orbitPathCCW {
      from { offset-distance: 100%; }
      to   { offset-distance: 0%; }
    }
  `;
  document.head.appendChild(style);
}

interface OrbitWrapProps {
  planet: PlanetName;
  children: React.ReactNode;
  className?: string;
}

const OrbitWrap: React.FC<OrbitWrapProps> = ({ planet, children, className = "" }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const planetRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(isOrbitTheme());

  const cfg = ORBIT_CFG[planet];

  // Track theme changes
  useEffect(() => {
    const check = () => setVisible(isOrbitTheme());
    check();
    window.addEventListener("theme-changed", check);
    window.addEventListener("storage", check);
    const iv = setInterval(check, 1000);
    return () => {
      window.removeEventListener("theme-changed", check);
      window.removeEventListener("storage", check);
      clearInterval(iv);
    };
  }, []);

  const applyPath = useCallback(() => {
    const wrap = wrapRef.current;
    const planetEl = planetRef.current;
    const guideEl = guideRef.current;
    if (!wrap || !planetEl || !guideEl) return;

    // Find the GlassContainer child
    const card = wrap.querySelector("[data-glass-variant]") as HTMLElement | null;
    const target = card || wrap;
    const rect = target.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 10 || h < 10) return;

    // GlassContainer border-radius is 10px
    const r = 10;

    // Build SVG rounded-rect path — follows the card border exactly
    const svgPath = `M ${r},0 H ${w - r} A ${r},${r} 0 0,1 ${w},${r} V ${h - r} A ${r},${r} 0 0,1 ${w - r},${h} H ${r} A ${r},${r} 0 0,1 0,${h - r} V ${r} A ${r},${r} 0 0,1 ${r},0 Z`;

    // Update orbit guide to match card dimensions
    guideEl.style.width = `${w}px`;
    guideEl.style.height = `${h}px`;
    guideEl.style.borderRadius = `${r}px`;

    // Apply offset-path via setProperty (React inline styles don't support this)
    ensureKeyframes();
    planetEl.style.setProperty("offset-path", `path('${svgPath}')`);
    planetEl.style.setProperty("offset-anchor", "50% 50%");
    planetEl.style.setProperty("offset-rotate", "0deg");
    planetEl.style.setProperty("animation", `${cfg.ccw ? "orbitPathCCW" : "orbitPathCW"} ${cfg.dur}s linear infinite`);
  }, [cfg]);

  useEffect(() => {
    if (!visible) return;
    // Wait for layout then apply
    const raf = requestAnimationFrame(() => {
      applyPath();
      // Re-apply after a short delay (framer-motion may still be animating)
      setTimeout(applyPath, 300);
    });
    const ro = new ResizeObserver(applyPath);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [visible, applyPath]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", display: "inline-block" }}
    >
      {children}

      {visible && (
        <>
          {/* Dashed orbit guide — matches card border exactly */}
          <div
            ref={guideRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              border: "1px dashed hsla(262, 85%, 70%, 0.25)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* Planet — traces the card border via offset-path */}
          <div
            ref={planetRef}
            className={`planet planet-${planet}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        </>
      )}
    </div>
  );
};

export default OrbitWrap;
