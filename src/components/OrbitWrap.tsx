/**
 * OrbitWrap — Wraps a header panel with a planet orbiting its perimeter.
 *
 * Uses CSS offset-path to trace a rounded-rectangle path matching
 * the child GlassContainer's dimensions. The planet smoothly follows
 * the actual border of the card.
 *
 * Only visible when the active theme supports orbits (Midnight, Sunset).
 * On other themes, CSS hides the guide and planet via .orbit-guide / .orbit-planet-container selectors.
 *
 * Usage:
 *   <OrbitWrap planet="earth">
 *     <GlassContainer ...>header content</GlassContainer>
 *   </OrbitWrap>
 */

import React, { useRef, useEffect } from "react";

export type PlanetName = "earth" | "saturn" | "venus" | "jupiter" | "neptune";

/* Per-planet orbit durations (seconds) */
const ORBIT_DURATION: Record<PlanetName, number> = {
  earth: 12,
  saturn: 18,
  venus: 10,
  jupiter: 8,
  neptune: 25,
};

/* Direction: true = clockwise (CW), false = counter-clockwise (CCW) */
const ORBIT_CW: Record<PlanetName, boolean> = {
  earth: true,
  saturn: true,
  venus: false,
  jupiter: true,
  neptune: true,
};

interface OrbitWrapProps {
  planet: PlanetName;
  children: React.ReactNode;
  className?: string;
}

const PADDING = 8;   // orbit guide sits this far outside the card
const CARD_R = 10;   // GlassContainer border-radius
const PATH_R = CARD_R + PADDING;

const OrbitWrap: React.FC<OrbitWrapProps> = ({ planet, children, className = "" }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const planetRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const planetEl = planetRef.current;
    const guideEl = guideRef.current;
    if (!wrap || !planetEl || !guideEl) return;

    let rafId: number;
    let roCleanup: (() => void) | null = null;

    const apply = () => {
      // Find the GlassContainer child, fallback to wrap
      const card = wrap.querySelector("[data-glass-variant]") as HTMLElement | null;
      const rect = (card || wrap).getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 10 || h < 10) {
        // Not laid out yet — try again next frame
        rafId = requestAnimationFrame(apply);
        return;
      }

      const pathW = w + PADDING * 2;
      const pathH = h + PADDING * 2;
      const r = PATH_R;

      // Update orbit guide dimensions
      guideEl.style.width = `${pathW}px`;
      guideEl.style.height = `${pathH}px`;
      guideEl.style.borderRadius = `${r}px`;

      // Build SVG rounded-rect path
      const svgPath = `M ${r},0 H ${pathW - r} A ${r},${r} 0 0,1 ${pathW},${r} V ${pathH - r} A ${r},${r} 0 0,1 ${pathW - r},${pathH} H ${r} A ${r},${r} 0 0,1 0,${pathH - r} V ${r} A ${r},${r} 0 0,1 ${r},0 Z`;

      // Apply offset-path directly via setProperty
      const dur = ORBIT_DURATION[planet];
      const cw = ORBIT_CW[planet];

      planetEl.style.setProperty("offset-path", `path('${svgPath}')`);
      planetEl.style.setProperty("offset-anchor", "50% 50%");
      planetEl.style.setProperty("offset-rotate", "0deg");
      planetEl.style.setProperty("animation", `${cw ? "orbitCW" : "orbitCCW"} ${dur}s linear infinite`);
    };

    // Use rAF to wait for layout
    rafId = requestAnimationFrame(apply);

    // Also re-measure on resize
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(apply);
    });
    ro.observe(wrap);
    roCleanup = () => ro.disconnect();

    return () => {
      cancelAnimationFrame(rafId);
      roCleanup?.();
    };
  }, [planet]);

  return (
    <div ref={wrapRef} className={`orbit-wrap ${className}`} style={{ position: "relative", zIndex: 1 }}>
      {children}

      {/* Dashed orbit guide — sits PADDING px outside the card */}
      <div
        ref={guideRef}
        className="orbit-guide"
        style={{
          position: "absolute",
          top: -PADDING,
          left: -PADDING,
          width: 0,
          height: 0,
          border: "1px dashed var(--orbit-guide-color, hsla(262,85%,70%,0.18))",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Planet anchor — absolute at orbit origin, overflow visible */}
      <div
        className="orbit-planet-container"
        style={{
          position: "absolute",
          top: -PADDING,
          left: -PADDING,
          width: 0,
          height: 0,
          pointerEvents: "none",
          zIndex: 3,
          overflow: "visible",
        }}
      >
        <div
          ref={planetRef}
          className={`planet planet-${planet}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

export default OrbitWrap;
