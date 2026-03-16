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

import React, { useRef, useEffect, useCallback, useId } from "react";

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

const OrbitWrap: React.FC<OrbitWrapProps> = ({ planet, children, className = "" }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const planetRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const uid = useId().replace(/:/g, "");

  const PADDING = 8;
  const CARD_R = 10;
  const PATH_R = CARD_R + PADDING;

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const planetEl = planetRef.current;
    const guideEl = guideRef.current;
    if (!wrap || !planetEl || !guideEl) return;

    // Find the GlassContainer child
    const card = wrap.querySelector("[data-glass-variant]") as HTMLElement | null;
    const target = card || wrap;
    const rect = target.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    // Orbit path dims
    const pathW = w + PADDING * 2;
    const pathH = h + PADDING * 2;

    // Update guide
    guideEl.style.width = `${pathW}px`;
    guideEl.style.height = `${pathH}px`;
    guideEl.style.borderRadius = `${PATH_R}px`;

    // Build SVG rounded-rect path
    const r = PATH_R;
    const svgPath = `M ${r},0 H ${pathW - r} A ${r},${r} 0 0,1 ${pathW},${r} V ${pathH - r} A ${r},${r} 0 0,1 ${pathW - r},${pathH} H ${r} A ${r},${r} 0 0,1 0,${pathH - r} V ${r} A ${r},${r} 0 0,1 ${r},0 Z`;

    // Inject dynamic <style> with offset-path (avoids React inline style issues)
    const dur = ORBIT_DURATION[planet];
    const cw = ORBIT_CW[planet];
    const animName = cw ? "orbitCW" : "orbitCCW";
    const cls = `orbit-planet-${uid}`;

    planetEl.className = `planet planet-${planet} ${cls}`;

    if (!styleRef.current) {
      styleRef.current = document.createElement("style");
      document.head.appendChild(styleRef.current);
    }

    styleRef.current.textContent = `
      .${cls} {
        position: absolute;
        top: 0;
        left: 0;
        offset-path: path('${svgPath}');
        offset-anchor: 50% 50%;
        offset-rotate: 0deg;
        animation: ${animName} ${dur}s linear infinite;
        pointer-events: none;
      }
    `;
  }, [planet, uid, PADDING, PATH_R]);

  useEffect(() => {
    const timer = setTimeout(measure, 80);
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      // Clean up injected style
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
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
        }}
      />

      {/* Planet anchor — positioned at top-left of orbit area */}
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
        <div ref={planetRef} className={`planet planet-${planet}`} />
      </div>
    </div>
  );
};

export default OrbitWrap;
