/**
 * OrbitWrap — Wraps a header panel with a spinning planet arm.
 *
 * Only visible in Midnight / Sunset themes. Renders a dashed orbit track rail
 * and a rotating arm with a recognisable planet (Earth, Saturn, Venus,
 * Jupiter, Neptune) that travels around the panel border.
 *
 * Usage:
 *   <OrbitWrap planet="earth">
 *     <GlassContainer ...>header content</GlassContainer>
 *   </OrbitWrap>
 */

import React, { useEffect, useState } from "react";

export type PlanetName = "earth" | "saturn" | "venus" | "jupiter" | "neptune";

interface OrbitWrapProps {
  planet: PlanetName;
  children: React.ReactNode;
  className?: string;
}

/* Per-planet orbit durations (seconds) and direction */
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

const OrbitWrap: React.FC<OrbitWrapProps> = ({ planet, children, className = "" }) => {
  const [visible, setVisible] = useState(isOrbitTheme());

  // Listen for theme changes
  useEffect(() => {
    const check = () => setVisible(isOrbitTheme());
    check();
    window.addEventListener("theme-changed", check);
    // Also listen for storage events from Customize page
    window.addEventListener("storage", check);
    const interval = setInterval(check, 1000); // fallback poll
    return () => {
      window.removeEventListener("theme-changed", check);
      window.removeEventListener("storage", check);
      clearInterval(interval);
    };
  }, []);

  const cfg = ORBIT_CFG[planet];

  return (
    <div className={className} style={{ position: "relative", display: "inline-block" }}>
      {children}

      {visible && (
        <>
          {/* Dashed orbit track — 10px outside the card */}
          <div
            style={{
              position: "absolute",
              inset: "-10px",
              borderRadius: "22px",
              border: "1px dashed hsla(262, 85%, 70%, 0.25)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* Spinning arm — same size as the track, rotates around center */}
          <div
            style={{
              position: "absolute",
              inset: "-10px",
              borderRadius: "22px",
              pointerEvents: "none",
              zIndex: 4,
              overflow: "visible",
              animation: `${cfg.ccw ? "orbitCCW" : "orbitCW"} ${cfg.dur}s linear infinite`,
            }}
          >
            {/* Planet sits at top center of arm, 7px above border */}
            <div
              className={`planet planet-${planet}`}
              style={{
                position: "absolute",
                top: "-7px",
                left: "50%",
                transform: "translateX(-50%)",
                borderRadius: "50%",
                pointerEvents: "none",
                zIndex: 5,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default OrbitWrap;
