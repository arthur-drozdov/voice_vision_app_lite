/**
 * MidnightPresetOverlays.tsx
 *
 * Custom CSS-animated overlay components for each Midnight wallpaper preset.
 * These render ON TOP of the base gradient in MidnightBg.
 */
import { useMemo } from "react";

/* ── Helper: seeded pseudo-random for deterministic star positions ── */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. VIOLET NEBULA  — gradient blobs + random twinkling CSS stars
   ═══════════════════════════════════════════════════════════════════════════ */

export const VioletNebulaOverlay = () => {
  const stars = useMemo(() => {
    const rng = seededRandom(42);
    return Array.from({ length: 45 }, (_, i) => ({
      id: i,
      left: rng() * 100,
      top: rng() * 100,
      size: 1 + rng() * 2,
      delay: rng() * 6,
      duration: 2 + rng() * 4,
    }));
  }, []);

  return (
    <>
      {/* Nebula blobs */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", width: "140%", height: "140%", top: "-20%", left: "-20%",
          background: "radial-gradient(ellipse 70% 55% at 28% 35%, hsla(262,75%,38%,0.45) 0%, transparent 70%)",
          filter: "blur(45px)", borderRadius: "50%",
          animation: "midnight-nebula-breath 16s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", width: "140%", height: "140%", top: "-20%", left: "-20%",
          background: "radial-gradient(ellipse 60% 50% at 72% 25%, hsla(275,65%,32%,0.35) 0%, transparent 70%)",
          filter: "blur(40px)", borderRadius: "50%",
          animation: "midnight-nebula-breath 22s ease-in-out infinite reverse",
        }} />
        <div style={{
          position: "absolute", width: "140%", height: "140%", top: "-20%", left: "-20%",
          background: "radial-gradient(ellipse 55% 45% at 55% 72%, hsla(262,70%,34%,0.38) 0%, transparent 70%)",
          filter: "blur(38px)", borderRadius: "50%",
          animation: "midnight-nebula-breath 28s ease-in-out infinite 6s",
        }} />
      </div>
      {/* Twinkling stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          className="midnight-star"
          style={{
            position: "absolute",
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "white",
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. MOON PHASES  — 7 realistic CSS moons, sequentially appearing top-to-bottom
   ═══════════════════════════════════════════════════════════════════════════ */

// Each moon: shadowOffset controls crescent shape (negative = left, positive = right, 0 = full)
const MOON_PHASE_DATA = [
  { name: "wax-crescent",  size: 22, shadowOffset: -7,  shadowSize: 22 },
  { name: "wax-quarter",   size: 26, shadowOffset: -13, shadowSize: 26 },
  { name: "wax-gibbous",   size: 30, shadowOffset: -22, shadowSize: 26 },
  { name: "full",          size: 36, shadowOffset: 0,   shadowSize: 0  },
  { name: "wan-gibbous",   size: 30, shadowOffset: 22,  shadowSize: 26 },
  { name: "wan-quarter",   size: 26, shadowOffset: 13,  shadowSize: 26 },
  { name: "wan-crescent",  size: 22, shadowOffset: 7,   shadowSize: 22 },
];

export const MoonPhasesOverlay = () => {
  const totalCycle = 28; // total seconds for a full cycle

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {MOON_PHASE_DATA.map((moon, i) => {
        const topPercent = 8 + i * 12;
        const isFull = moon.shadowSize === 0;
        const perPhase = totalCycle / MOON_PHASE_DATA.length;

        return (
          <div
            key={moon.name}
            style={{
              position: "absolute",
              left: "50%",
              top: `${topPercent}%`,
              transform: "translateX(-50%)",
              animation: `midnight-moon-phase-cycle ${totalCycle}s ease-in-out infinite`,
              animationDelay: `${i * perPhase}s`,
            }}
          >
            {/* Outer glow halo */}
            <div style={{
              position: "absolute",
              inset: -(moon.size * 0.5),
              borderRadius: "50%",
              background: `radial-gradient(circle, hsla(262,55%,65%,0.20) 0%, transparent 70%)`,
            }} />

            {/* Moon container */}
            <div style={{
              width: moon.size,
              height: moon.size,
              position: "relative",
              borderRadius: "50%",
              overflow: "hidden",
            }}>
              {/* Lit surface */}
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: `radial-gradient(circle at ${isFull ? "50% 45%" : "45% 40%"}, 
                  hsla(262,30%,88%,1) 0%, 
                  hsla(262,35%,75%,0.95) 35%, 
                  hsla(262,40%,60%,0.85) 65%, 
                  hsla(262,45%,50%,0.75) 100%)`,
                boxShadow: `0 0 ${moon.size * 0.4}px hsla(262,50%,65%,0.3)`,
              }} />

              {/* Shadow disc — creates crescent by covering part of the moon */}
              {!isFull && (
                <div style={{
                  position: "absolute",
                  top: -1,
                  left: moon.shadowOffset,
                  width: moon.shadowSize,
                  height: moon.size + 2,
                  borderRadius: "50%",
                  background: "hsl(240, 28%, 8%)",
                  boxShadow: "inset 0 0 4px hsla(240,30%,5%,0.8)",
                }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. LAVENDER MIST  — slowly rotating circle with 6 constellations
   ═══════════════════════════════════════════════════════════════════════════ */

// 6 simple constellation patterns (star positions + connecting lines)
const CONSTELLATIONS = [
  // Ursa Minor–like
  { stars: [[0,0],[12,8],[24,4],[36,14],[30,26],[18,22],[6,28]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]] },
  // Triangle
  { stars: [[0,0],[20,30],[40,4]], lines: [[0,1],[1,2],[2,0]] },
  // W-shape (Cassiopeia-like)
  { stars: [[0,12],[10,0],[20,14],[30,0],[40,14]], lines: [[0,1],[1,2],[2,3],[3,4]] },
  // Cross
  { stars: [[20,0],[20,12],[10,20],[20,20],[30,20],[20,28]], lines: [[0,1],[1,3],[2,3],[3,4],[3,5]] },
  // Diamond
  { stars: [[18,0],[0,16],[18,32],[36,16]], lines: [[0,1],[1,2],[2,3],[3,0]] },
  // Dipper-like
  { stars: [[0,0],[14,6],[28,2],[34,14],[28,24],[14,20],[0,16]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]] },
];

export const LavenderMistOverlay = () => {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Slowly rotating constellation circle */}
      <div style={{
        position: "absolute",
        width: "280px",
        height: "280px",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        animation: "midnight-constellation-rotate 120s linear infinite",
      }}>
        {CONSTELLATIONS.map((c, ci) => {
          const angle = (ci / 6) * 360;
          const radius = 110;
          const cx = 140 + Math.cos((angle * Math.PI) / 180) * radius;
          const cy = 140 + Math.sin((angle * Math.PI) / 180) * radius;

          return (
            <svg
              key={ci}
              width="44"
              height="36"
              viewBox="-2 -2 44 36"
              style={{
                position: "absolute",
                left: cx - 22,
                top: cy - 18,
                opacity: 0.55,
                filter: "drop-shadow(0 0 3px hsla(262,70%,75%,0.5))",
              }}
            >
              {/* Lines */}
              {c.lines.map(([a, b], li) => (
                <line
                  key={li}
                  x1={c.stars[a][0]} y1={c.stars[a][1]}
                  x2={c.stars[b][0]} y2={c.stars[b][1]}
                  stroke="hsla(262,60%,75%,0.35)"
                  strokeWidth="0.8"
                />
              ))}
              {/* Stars */}
              {c.stars.map(([x, y], si) => (
                <circle
                  key={si}
                  cx={x} cy={y} r="1.5"
                  fill="hsla(258,80%,88%,0.85)"
                />
              ))}
            </svg>
          );
        })}
      </div>

      {/* Center glow */}
      <div style={{
        position: "absolute",
        width: "180px",
        height: "180px",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "radial-gradient(circle, hsla(258,45%,35%,0.20) 0%, transparent 70%)",
        borderRadius: "50%",
        animation: "midnight-celestial-pulse 8s ease-in-out infinite",
      }} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. CELESTIAL MAP  — cycling groups of 3 constellations
   ═══════════════════════════════════════════════════════════════════════════ */

// 9 constellations in 3 groups of 3, cycling visibility
const MAP_CONSTELLATIONS = [
  // Group A
  { stars: [[0,0],[16,10],[32,6],[22,22]], lines: [[0,1],[1,2],[1,3]], pos: [12,15] },
  { stars: [[0,8],[14,0],[28,10],[14,22]], lines: [[0,1],[1,2],[2,3],[3,0]], pos: [65,55] },
  { stars: [[0,0],[20,4],[10,18],[30,20]], lines: [[0,1],[1,3],[0,2],[2,3]], pos: [35,75] },
  // Group B
  { stars: [[0,14],[12,0],[24,8],[36,2],[20,22]], lines: [[0,1],[1,2],[2,3],[2,4]], pos: [55,12] },
  { stars: [[0,0],[18,14],[36,4]], lines: [[0,1],[1,2],[2,0]], pos: [10,60] },
  { stars: [[0,0],[10,16],[24,10],[18,26],[32,22]], lines: [[0,1],[1,2],[1,3],[3,4]], pos: [70,80] },
  // Group C
  { stars: [[0,10],[12,0],[24,12],[12,24]], lines: [[0,1],[1,2],[2,3],[3,0]], pos: [25,40] },
  { stars: [[0,0],[18,8],[36,0],[18,20]], lines: [[0,1],[1,2],[1,3]], pos: [60,30] },
  { stars: [[0,0],[14,14],[28,6],[14,26],[28,22]], lines: [[0,1],[1,2],[1,3],[3,4]], pos: [45,85] },
];

export const CelestialMapOverlay = () => {
  const cycleDuration = 12; // seconds per group visible

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 50%, transparent 50%, hsla(248,42%,7%,0.45) 100%)",
      }} />

      {MAP_CONSTELLATIONS.map((c, ci) => {
        const groupIndex = Math.floor(ci / 3); // 0, 1, or 2
        const totalCycle = cycleDuration * 3;

        return (
          <svg
            key={ci}
            width="42"
            height="30"
            viewBox="-2 -2 42 30"
            className="midnight-constellation-group"
            style={{
              position: "absolute",
              left: `${c.pos[0]}%`,
              top: `${c.pos[1]}%`,
              transform: "translate(-50%, -50%)",
              filter: "drop-shadow(0 0 4px hsla(42,70%,70%,0.4))",
              animationDuration: `${totalCycle}s`,
              animationDelay: `${groupIndex * cycleDuration}s`,
            }}
          >
            {/* Lines */}
            {c.lines.map(([a, b], li) => (
              <line
                key={li}
                x1={c.stars[a][0]} y1={c.stars[a][1]}
                x2={c.stars[b][0]} y2={c.stars[b][1]}
                stroke="hsla(42,60%,65%,0.30)"
                strokeWidth="0.7"
              />
            ))}
            {/* Stars */}
            {c.stars.map(([x, y], si) => (
              <circle
                key={si}
                cx={x} cy={y} r="1.8"
                fill="hsla(42,75%,75%,0.75)"
              />
            ))}
          </svg>
        );
      })}
    </div>
  );
};
