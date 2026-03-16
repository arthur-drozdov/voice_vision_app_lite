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

import React, { useRef, useEffect, useState, useCallback } from "react";

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

/** Build an SVG rounded-rect path for offset-path */
function buildRRectPath(w: number, h: number, r: number): string {
  return `path('M ${r},0 H ${w - r} A ${r},${r} 0 0,1 ${w},${r} V ${h - r} A ${r},${r} 0 0,1 ${w - r},${h} H ${r} A ${r},${r} 0 0,1 0,${h - r} V ${r} A ${r},${r} 0 0,1 ${r},0 Z')`;
}

interface OrbitWrapProps {
  planet: PlanetName;
  children: React.ReactNode;
  className?: string;
}

const OrbitWrap: React.FC<OrbitWrapProps> = ({ planet, children, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const child = containerRef.current.querySelector("[data-glass-variant]") as HTMLElement;
    if (!child) {
      // Fallback: measure the container itself
      const rect = containerRef.current.getBoundingClientRect();
      setDims({ w: rect.width, h: rect.height });
    } else {
      const rect = child.getBoundingClientRect();
      setDims({ w: rect.width, h: rect.height });
    }
  }, []);

  useEffect(() => {
    // Measure after render + a small delay for layout
    const timer = setTimeout(measure, 50);
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [measure]);

  const borderRadius = 10; // matches GlassContainer's border-radius
  const padding = 8; // how far outside the card edge the orbit sits
  const dur = ORBIT_DURATION[planet];
  const cw = ORBIT_CW[planet];

  // Orbit path dimensions = card + padding on each side
  const pathW = dims ? dims.w + padding * 2 : 0;
  const pathH = dims ? dims.h + padding * 2 : 0;
  const pathR = borderRadius + padding;

  const offsetPath = dims ? buildRRectPath(pathW, pathH, pathR) : "";

  return (
    <div ref={containerRef} className={`orbit-wrap ${className}`} style={{ position: "relative", zIndex: 1 }}>
      {children}

      {dims && (
        <>
          {/* Dashed orbit guide */}
          <div
            className="orbit-guide"
            style={{
              position: "absolute",
              top: -padding,
              left: -padding,
              width: pathW,
              height: pathH,
              borderRadius: pathR,
              border: "1px dashed var(--orbit-guide-color, hsla(262,85%,70%,0.18))",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* Planet — follows the rounded-rect path */}
          <div
            className="orbit-planet-container"
            style={{
              position: "absolute",
              top: -padding,
              left: -padding,
              width: 0,
              height: 0,
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            <div
              className={`planet planet-${planet}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                offsetPath,
                offsetAnchor: "50% 50%",
                offsetRotate: "0deg",
                animation: `${cw ? "orbitCW" : "orbitCCW"} ${dur}s linear infinite`,
                pointerEvents: "none",
              } as React.CSSProperties}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default OrbitWrap;
