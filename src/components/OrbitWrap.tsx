/**
 * OrbitWrap — Wraps a header panel with a planet orbiting its perimeter.
 *
 * Uses CSS offset-path to trace a rounded-rectangle path matching
 * the child GlassContainer's dimensions. The planet smoothly follows
 * the actual border of the card.
 *
 * Only visible when the active theme supports orbits (Midnight, Sunset).
 *
 * Usage:
 *   <OrbitWrap planet="earth">
 *     <GlassContainer ...>header content</GlassContainer>
 *   </OrbitWrap>
 */

import React, { useRef, useEffect, useCallback } from "react";

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

const PADDING = 8;
const CARD_R = 10;
const PATH_R = CARD_R + PADDING;

const OrbitWrap: React.FC<OrbitWrapProps> = ({ planet, children, className = "" }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const planetRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const planetEl = planetRef.current;
    const guideEl = guideRef.current;
    if (!wrap || !planetEl || !guideEl) return;

    // Find the GlassContainer child, fallback to wrap itself
    const card = wrap.querySelector("[data-glass-variant]") as HTMLElement | null;
    const rect = (card || wrap).getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 10 || h < 10) return; // not laid out yet

    // Orbit path dims = card + padding on each side
    const pathW = w + PADDING * 2;
    const pathH = h + PADDING * 2;

    // Update orbit guide
    guideEl.style.width = `${pathW}px`;
    guideEl.style.height = `${pathH}px`;
    guideEl.style.borderRadius = `${PATH_R}px`;
    guideEl.style.display = "";

    // Build SVG rounded-rect path
    const r = PATH_R;
    const svgPath = `M ${r},0 H ${pathW - r} A ${r},${r} 0 0,1 ${pathW},${r} V ${pathH - r} A ${r},${r} 0 0,1 ${pathW - r},${pathH} H ${r} A ${r},${r} 0 0,1 0,${pathH - r} V ${r} A ${r},${r} 0 0,1 ${r},0 Z`;

    // Apply offset-path directly on the DOM node (React inline styles don't handle these)
    const dur = ORBIT_DURATION[planet];
    const cw = ORBIT_CW[planet];
    const animName = cw ? "orbitCW" : "orbitCCW";

    planetEl.style.setProperty("offset-path", `path('${svgPath}')`);
    planetEl.style.setProperty("offset-anchor", "50% 50%");
    planetEl.style.setProperty("offset-rotate", "0deg");
    planetEl.style.setProperty("animation", `${animName} ${dur}s linear infinite`);
    planetEl.style.setProperty("position", "absolute");
    planetEl.style.setProperty("top", "0");
    planetEl.style.setProperty("left", "0");
    planetEl.style.setProperty("pointer-events", "none");

    // Make planet container visible
    planetEl.parentElement!.style.display = "";
  }, [planet]);

  useEffect(() => {
    // Measure after layout settles
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 200); // fallback for slow layouts
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [measure]);

  return (
    <div ref={wrapRef} className={`orbit-wrap ${className}`} style={{ position: "relative", zIndex: 1 }}>
      {children}

      {/* Dashed orbit guide */}
      <div
        ref={guideRef}
        className="orbit-guide"
        style={{
          position: "absolute",
          top: -PADDING,
          left: -PADDING,
          border: "1px dashed var(--orbit-guide-color, hsla(262,85%,70%,0.18))",
          pointerEvents: "none",
          zIndex: 0,
          display: "none", // hidden until measured
        }}
      />

      {/* Planet container — positioned at orbit origin */}
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
          display: "none", // hidden until measured
        }}
      >
        <div ref={planetRef} className={`planet planet-${planet}`} />
      </div>
    </div>
  );
};

export default OrbitWrap;
