/**
 * Sunset Theme — Canvas 2D Van Gogh Scene Painters
 *
 * Six paint functions that render Van Gogh-inspired impasto brushstroke
 * paintings onto an HTML Canvas element. Each function fills the entire
 * canvas with a complete scene.
 *
 * All scenes use seeded PRNG for deterministic output.
 */

/* ── Utilities ── */

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function stroke(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  len: number, angle: number,
  color: string, w: number, alpha?: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha !== undefined ? alpha : 0.55 + Math.random() * 0.45;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, w * 1.4, len, 0);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

export type SunsetPainter = (canvas: HTMLCanvasElement) => void;

/* ═══════════════════════════════════════
   1. STARRY DUSK
   Van Gogh lake sunset · swirling sky · cypress trees · water reflection
   ═══════════════════════════════════════ */

export function drawStarryDusk(cv: HTMLCanvasElement): void {
  const ctx = cv.getContext("2d")!;
  const W = cv.width, H = cv.height;
  const rng = seededRng(1111);
  const HZ = H * 0.52;

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, HZ);
  sky.addColorStop(0, "#2E1228"); sky.addColorStop(0.12, "#4A1E30");
  sky.addColorStop(0.22, "#7A2828"); sky.addColorStop(0.36, "#B83820");
  sky.addColorStop(0.52, "#D85A18"); sky.addColorStop(0.66, "#E87828");
  sky.addColorStop(0.80, "#F4A030"); sky.addColorStop(0.90, "#F8C040");
  sky.addColorStop(1, "#FEDE70");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HZ);

  // Swirling VG brushstrokes
  const vrt = [
    { cx: W * 0.50, cy: HZ * 0.82, s: 1.0, r: 100 },
    { cx: W * 0.12, cy: HZ * 0.35, s: 0.55, r: 75 },
    { cx: W * 0.82, cy: HZ * 0.30, s: 0.48, r: 68 },
  ];
  const sp = [
    ["#3A1430", "#5A1C38", "#8A2440"],
    ["#802030", "#A02C28", "#C03820"],
    ["#C04820", "#D05A1A", "#E07020"],
    ["#E08028", "#EE9830", "#F4AE3A"],
    ["#F6B840", "#FAC850", "#FED468"],
  ];
  for (let gx = 2; gx < W; gx += 7) {
    for (let gy = 2; gy < HZ; gy += 7) {
      let dx = 0, dy = 0;
      vrt.forEach(v => {
        const vx = gx - v.cx, vy = gy - v.cy;
        const d = Math.sqrt(vx * vx + vy * vy) + 1;
        const wt = v.s / (1 + d / v.r);
        dx += (-vy / d) * wt;
        dy += (vx / d) * wt;
      });
      const angle = Math.atan2(dy, dx) + (rng() - 0.5) * 0.55;
      const pi = Math.min(4, Math.floor(gy / HZ * 5));
      stroke(ctx, gx, gy, 8 + rng() * 7, angle, sp[pi][Math.floor(rng() * 3)], 2 + rng() * 2, 0.50 + rng() * 0.50);
    }
  }

  // Purple-grey cloud masses
  [[W * 0.18, HZ * 0.18, 55, 0.42], [W * 0.75, HZ * 0.25, 45, 0.38], [W * 0.45, HZ * 0.12, 40, 0.32]].forEach(([cx, cy, r, a]) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `hsla(278,35%,42%,${a})`);
    g.addColorStop(0.5, `hsla(272,32%,35%,${a * 0.6})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  });

  // Sun disc
  const sx = W * 0.55, sy = HZ * 0.92;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 28);
  sg.addColorStop(0, "rgba(255,255,220,.98)");
  sg.addColorStop(0.3, "rgba(255,220,100,.50)");
  sg.addColorStop(1, "transparent");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = sg;
  ctx.fillRect(sx - 30, sy - 30, 60, 60);
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,210,.95)"; ctx.fill();

  // Shoreline silhouette
  ctx.fillStyle = "#141820";
  ctx.beginPath(); ctx.moveTo(0, HZ);
  for (let x = 0; x <= W; x += 5) ctx.lineTo(x, HZ - Math.sin(x * 0.018) * H * 0.04 - Math.sin(x * 0.052 + 1.5) * H * 0.02);
  ctx.lineTo(W, HZ); ctx.closePath(); ctx.fill();

  // Water
  const water = ctx.createLinearGradient(0, HZ, 0, H);
  water.addColorStop(0, "#C04818"); water.addColorStop(0.25, "#8A2810");
  water.addColorStop(0.55, "#4A1008"); water.addColorStop(1, "#180606");
  ctx.fillStyle = water;
  ctx.fillRect(0, HZ, W, H - HZ);

  // Water ripple strokes
  for (let i = 0; i < 180; i++) {
    const y = HZ + rng() * (H - HZ);
    const t = (y - HZ) / (H - HZ);
    const col = `hsl(${28 - t * 14},${62 - t * 20}%,${Math.max(8, 52 - t * 45)}%)`;
    ctx.save(); ctx.globalAlpha = 0.35 + rng() * 0.40;
    ctx.beginPath(); ctx.moveTo(rng() * W, y);
    ctx.quadraticCurveTo(rng() * W, y + 2, rng() * W, y);
    ctx.lineWidth = 1.5 + rng() * 2;
    ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.stroke(); ctx.restore();
  }

  // Sun reflection column
  ctx.globalCompositeOperation = "screen";
  const ref = ctx.createLinearGradient(0, HZ, 0, H);
  ref.addColorStop(0, "hsla(44,90%,72%,.45)");
  ref.addColorStop(0.4, "hsla(38,85%,60%,.22)");
  ref.addColorStop(1, "transparent");
  ctx.fillStyle = ref;
  ctx.beginPath(); ctx.ellipse(sx, H, 22, H - HZ, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Cypress trees
  function cypress(tx: number, ty: number) {
    ctx.fillStyle = "#0C0E14";
    for (let i = 0; i < 8; i++) {
      const py = ty - i * 4;
      const hw = Math.max(1, 6 - i * 0.3);
      ctx.fillRect(tx - hw, py, hw * 2, 4.5);
    }
  }
  cypress(W * 0.12, HZ); cypress(W * 0.16, HZ);
  cypress(W * 0.78, HZ); cypress(W * 0.82, HZ);
}


/* ═══════════════════════════════════════
   2. MEADOW PATH
   Impasto oil painting · purple sunset clouds · wildflower field · winding path
   ═══════════════════════════════════════ */

export function drawMeadowPath(cv: HTMLCanvasElement): void {
  const ctx = cv.getContext("2d")!;
  const W = cv.width, H = cv.height;
  const rng = seededRng(2222);
  const HZ = H * 0.48;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, HZ);
  sky.addColorStop(0, "#2C1E3A"); sky.addColorStop(0.15, "#4A2848");
  sky.addColorStop(0.28, "#6A3052"); sky.addColorStop(0.42, "#7C2840");
  sky.addColorStop(0.55, "#A03228"); sky.addColorStop(0.68, "#CC5020");
  sky.addColorStop(0.80, "#E07828"); sky.addColorStop(0.90, "#F0A030");
  sky.addColorStop(1, "#F8C848");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HZ);

  // Sky strokes
  for (let i = 0; i < 200; i++) {
    const x = rng() * W, y = rng() * HZ * 0.72;
    const t = y / HZ;
    const col = t < 0.45
      ? `hsl(${275 + rng() * 20},${28 + rng() * 12}%,${38 + rng() * 18}%)`
      : `hsl(${22 + t * 10},${60 + rng() * 20}%,${30 + rng() * 25}%)`;
    stroke(ctx, x, y, 12 + rng() * 20, (rng() - 0.5) * 0.9, col, 3.5 + rng() * 4.0, 0.55 + rng() * 0.45);
  }

  // Sun
  const sx = W * 0.52, sy = HZ * 0.88;
  ctx.globalCompositeOperation = "screen";
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 30);
  sg.addColorStop(0, "rgba(255,255,220,.95)"); sg.addColorStop(0.3, "rgba(255,240,160,.60)");
  sg.addColorStop(1, "transparent");
  ctx.fillStyle = sg; ctx.fillRect(sx - 32, sy - 32, 64, 64);
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,210,.95)"; ctx.fill();

  // Ground
  const ground = ctx.createLinearGradient(0, HZ, 0, H);
  ground.addColorStop(0, "#2A4A18"); ground.addColorStop(0.3, "#3A5820");
  ground.addColorStop(0.65, "#324818"); ground.addColorStop(1, "#1E3010");
  ctx.fillStyle = ground; ctx.fillRect(0, HZ, W, H - HZ);

  // Winding path
  ctx.fillStyle = "#8A6A40";
  ctx.beginPath();
  ctx.moveTo(W * 0.35, H);
  ctx.quadraticCurveTo(W * 0.46, H * 0.72, W * 0.50, HZ);
  ctx.lineTo(W * 0.53, HZ);
  ctx.quadraticCurveTo(W * 0.54, H * 0.72, W * 0.65, H);
  ctx.closePath(); ctx.fill();

  // Ground strokes
  for (let i = 0; i < 220; i++) {
    const x = rng() * W, y = HZ + rng() * (H - HZ);
    const t = (y - HZ) / (H - HZ);
    stroke(ctx, x, y, 8 + rng() * 14, (rng() - 0.5) * 0.6,
      `hsl(${96 + rng() * 20},${45 + rng() * 18}%,${22 + rng() * 16 - t * 6}%)`,
      2 + rng() * 2.5, 0.45 + rng() * 0.45);
  }

  // Tree line
  ctx.fillStyle = "#1A2C12";
  for (let i = 0; i < 8; i++) {
    const tx = W * (0.08 + i * 0.12);
    const tr = 12 + rng() * 10;
    ctx.beginPath(); ctx.arc(tx, HZ - tr * 0.6, tr, Math.PI, 0); ctx.fill();
  }

  // Wildflowers
  const fc = ["#E03028", "#E8A0A0", "#D060C0", "#E0A020", "#FFFFFF", "#C060C0", "#E86040", "#F0D0A0"];
  for (let i = 0; i < 140; i++) {
    const x = rng() * W, y = HZ * 1.08 + rng() * (H - HZ) * 0.92;
    if (y > H) continue;
    const pw = (y - HZ) / (H - HZ) * W * 0.15 + 10;
    if (Math.abs(x - W * 0.50) < pw) continue; // skip path area
    ctx.beginPath(); ctx.arc(x, y, 2 + rng() * 4, 0, Math.PI * 2);
    ctx.fillStyle = fc[Math.floor(rng() * fc.length)];
    ctx.globalAlpha = 0.75 + rng() * 0.25; ctx.fill(); ctx.globalAlpha = 1;
  }
}


/* ═══════════════════════════════════════
   3. WHEATFIELD
   Van Gogh wheat field · deep blue sky complement · golden impasto wheat
   ═══════════════════════════════════════ */

export function drawWheatfield(cv: HTMLCanvasElement): void {
  const ctx = cv.getContext("2d")!;
  const W = cv.width, H = cv.height;
  const rng = seededRng(3333);
  const HZ = H * 0.42;

  // Blue sky
  const sky = ctx.createLinearGradient(0, 0, 0, HZ);
  sky.addColorStop(0, "#0C2450"); sky.addColorStop(0.18, "#163A80");
  sky.addColorStop(0.36, "#1E52A8"); sky.addColorStop(0.52, "#2860C0");
  sky.addColorStop(0.68, "#C84010"); sky.addColorStop(0.82, "#E06818");
  sky.addColorStop(1, "#F09828");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HZ);

  // VG flow-field sky strokes
  const vrt = [
    { cx: W * 0.42, cy: HZ * 0.30, s: 1.0, r: 88 },
    { cx: W * 0.78, cy: HZ * 0.22, s: 0.60, r: 68 },
  ];
  const sp = [
    ["#0E2A5A", "#1A3A70", "#1E4A88"],
    ["#1A4A8A", "#2458AA", "#2A62B8"],
    ["#2A5CB0", "#3468BC", "#3A72C0"],
    ["#B03A14", "#C04820", "#CC5820"],
    ["#D06818", "#E07820", "#EC9030"],
  ];
  for (let gx = 2; gx < W; gx += 7) {
    for (let gy = 2; gy < HZ; gy += 7) {
      let dx = 0, dy = 0;
      vrt.forEach(v => {
        const vx = gx - v.cx, vy = gy - v.cy;
        const d = Math.sqrt(vx * vx + vy * vy) + 1;
        const wt = v.s / (1 + d / v.r);
        dx += (-vy / d) * wt;
        dy += (vx / d) * wt;
      });
      const angle = Math.atan2(dy, dx) + (rng() - 0.5) * 0.55;
      const pi = Math.min(4, Math.floor(gy / HZ * 5));
      stroke(ctx, gx, gy, 8 + rng() * 7, angle, sp[pi][Math.floor(rng() * 3)], 2 + rng() * 2, 0.50 + rng() * 0.50);
    }
  }

  // Orange clouds at horizon
  [[W * 0.28, HZ * 0.78, 55], [W * 0.72, HZ * 0.70, 42]].forEach(([cx, cy, r]) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "hsla(22,85%,55%,.55)"); g.addColorStop(0.5, "hsla(18,78%,42%,.28)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  });

  // Sun
  const sx = W * 0.56, sy = HZ * 0.93;
  ctx.globalCompositeOperation = "screen";
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 26);
  sg.addColorStop(0, "rgba(255,255,200,.95)"); sg.addColorStop(0.3, "rgba(255,230,120,.55)");
  sg.addColorStop(0.7, "rgba(255,180,60,.22)"); sg.addColorStop(1, "transparent");
  ctx.fillStyle = sg; ctx.fillRect(sx - 28, sy - 28, 56, 56);
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,200,.95)"; ctx.fill();

  // Wheat field base
  const wheat = ctx.createLinearGradient(0, HZ, 0, H);
  wheat.addColorStop(0, "#6A5A12"); wheat.addColorStop(0.25, "#8A7418");
  wheat.addColorStop(0.55, "#B09420"); wheat.addColorStop(0.80, "#C8A424");
  wheat.addColorStop(1, "#9A8018");
  ctx.fillStyle = wheat; ctx.fillRect(0, HZ, W, H - HZ);

  // Wheat blade strokes
  for (let i = 0; i < 420; i++) {
    const x = rng() * W, baseY = HZ + (0.35 + rng() * 0.65) * (H - HZ);
    const angle = -Math.PI * 0.5 + (rng() - 0.5) * 0.85;
    const len = 8 + rng() * 20;
    const t = (baseY - HZ) / (H - HZ);
    const col = `hsl(${46 + rng() * 14},${62 + rng() * 16}%,${38 + rng() * 22 - t * 10}%)`;
    stroke(ctx, x, baseY, len, angle, col, 1.5 + rng() * 2, 0.42 + rng() * 0.48);
  }

  // Dark tree accents
  ctx.fillStyle = "#1A2E0A";
  for (let i = 0; i < 6; i++) {
    const tx = rng() * W, ty = HZ + 6;
    for (let j = 0; j < 6; j++) {
      const py = ty - j * 5;
      const hw = Math.max(1, 5 - j * 0.4);
      ctx.fillRect(tx - hw, py, hw * 2, 5);
    }
  }
}


/* ═══════════════════════════════════════
   4. EMBER WAVE
   Golden sunset ocean wave · fire-lit crest · deep red trough · sea spray sparks
   ═══════════════════════════════════════ */

export function drawEmberWave(cv: HTMLCanvasElement): void {
  const ctx = cv.getContext("2d")!;
  const W = cv.width, H = cv.height;
  const rng = seededRng(4444);

  // Sky
  const sg2 = ctx.createLinearGradient(0, 0, 0, H * 0.42);
  sg2.addColorStop(0, "#200804"); sg2.addColorStop(0.4, "#501210");
  sg2.addColorStop(0.8, "#8A2810"); sg2.addColorStop(1, "#C04818");
  ctx.fillStyle = sg2; ctx.fillRect(0, 0, W, H * 0.42);

  // Base water
  const wg = ctx.createLinearGradient(0, H * 0.42, 0, H);
  wg.addColorStop(0, "#8B1A06"); wg.addColorStop(0.2, "#6A1008");
  wg.addColorStop(0.5, "#3A0808"); wg.addColorStop(1, "#180404");
  ctx.fillStyle = wg; ctx.fillRect(0, H * 0.42, W, H * 0.58);

  // Wave function
  function waveY(x: number) {
    return H * 0.58 - Math.sin(x / W * Math.PI) * H * 0.22 - Math.sin(x / W * Math.PI * 2) * H * 0.04;
  }

  // Wave fill
  const wvg = ctx.createLinearGradient(0, H * 0.30, 0, H * 0.65);
  wvg.addColorStop(0, "#FCD050"); wvg.addColorStop(0.08, "#F4A030");
  wvg.addColorStop(0.20, "#E07020"); wvg.addColorStop(0.38, "#C04010");
  wvg.addColorStop(0.55, "#8A1A08"); wvg.addColorStop(0.80, "#4A0C04");
  wvg.addColorStop(1, "#1E0804");
  ctx.fillStyle = wvg;
  ctx.beginPath(); ctx.moveTo(0, waveY(0));
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, waveY(x));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  // Wave contour strokes
  for (let i = 0; i < 320; i++) {
    const x = rng() * W, wy = waveY(x);
    const depth = rng(), y = wy + depth * (H - wy) * 0.9;
    const fa = Math.atan2(waveY(x + 2) - waveY(x - 2), 4) + (rng() - 0.5) * 0.6;
    const t = (y - wy) / (H - wy);
    stroke(ctx, x, y, 10 + rng() * 12, fa,
      `hsl(${28 - t * 18},${80 - t * 25}%,${Math.max(12, 70 - t * 60)}%)`,
      2 + rng() * 2.5, 0.40 + rng() * 0.45);
  }

  // Golden foam crest
  ctx.globalCompositeOperation = "screen";
  for (let x = 10; x < W; x += 8) {
    const cy = waveY(x) - 2;
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, 18);
    g.addColorStop(0, "hsla(46,98%,88%,.60)"); g.addColorStop(0.3, "hsla(42,95%,72%,.25)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(x - 18, cy - 18, 36, 36);
  }
  ctx.globalCompositeOperation = "source-over";

  // Sea spray particles
  for (let i = 0; i < 140; i++) {
    const x = rng() * W, wy = waveY(x), y = wy - rng() * 40;
    if (y < 0) continue;
    ctx.beginPath(); ctx.arc(x, y, 0.6 + rng() * 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,${200 + rng() * 55},${80 + rng() * 80},${0.45 + rng() * 0.55})`;
    ctx.fill();
  }

  // Sky strokes
  for (let i = 0; i < 180; i++) {
    const x = rng() * W, y = rng() * H * 0.42;
    const t = y / (H * 0.42);
    stroke(ctx, x, y, 12 + rng() * 16, (rng() - 0.5) * 0.8,
      `hsl(${10 + t * 20},${68 + t * 15}%,${18 + t * 30}%)`,
      2 + rng() * 2.5, 0.35 + rng() * 0.40);
  }
}


/* ═══════════════════════════════════════
   5. CANYON FIRE
   Antelope Canyon · flowing sandstone waves · celestial light from above
   ═══════════════════════════════════════ */

export function drawCanyonFire(cv: HTMLCanvasElement): void {
  const ctx = cv.getContext("2d")!;
  const W = cv.width, H = cv.height;
  const rng = seededRng(5555);

  // Dark base
  ctx.fillStyle = "#100604";
  ctx.fillRect(0, 0, W, H);

  // Light beam from top
  const beam = ctx.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, H * 0.5, H * 0.85);
  beam.addColorStop(0, "hsla(25,90%,82%,.55)");
  beam.addColorStop(0.12, "hsla(22,85%,68%,.35)");
  beam.addColorStop(0.30, "hsla(18,80%,52%,.18)");
  beam.addColorStop(0.55, "hsla(14,70%,38%,.08)");
  beam.addColorStop(1, "transparent");
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, W, H);

  // Canyon wall strata
  const wc = [
    ["#C8603A", "#D47048", "#B85030"],
    ["#B84A2A", "#C85C38", "#A84028"],
    ["#A03828", "#B04838", "#903020"],
    ["#883020", "#982C1C", "#782818"],
    ["#703020", "#7C2C1C", "#641E14"],
    ["#5A2018", "#642018", "#501810"],
    ["#441810", "#4E180E", "#3C140C"],
    ["#341008", "#3C1008", "#2C0E06"],
    ["#240C06", "#2C0C06", "#1E0A04"],
  ];

  // Left wall
  wc.forEach((cols, i) => {
    const g = ctx.createLinearGradient(0, 0, W * 0.45, 0);
    g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0);
    const x1 = W * (0.08 + i * 0.04);
    for (let y = 0; y <= H; y += 8) ctx.lineTo(x1 + Math.sin(y * 0.018 + i * 0.8) * W * 0.06 + Math.sin(y * 0.04 + i) * W * 0.03, y);
    ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  });

  // Right wall
  wc.forEach((cols, i) => {
    const g = ctx.createLinearGradient(W, 0, W * 0.55, 0);
    g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(W, 0);
    const x1 = W * (0.92 - i * 0.04);
    for (let y = 0; y <= H; y += 8) ctx.lineTo(x1 - Math.sin(y * 0.022 + i * 0.9 + 1.5) * W * 0.06 - Math.sin(y * 0.038 + i + 2) * W * 0.03, y);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  });

  // Second beam pass
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";

  // Left wall brushstrokes
  for (let i = 0; i < 200; i++) {
    const x = rng() * W * 0.38, y = rng() * H, t = y / H;
    stroke(ctx, x, y, 10 + rng() * 14,
      Math.PI * 0.5 + (rng() - 0.5) * 0.8 + Math.sin(y * 0.02) * 0.4,
      `hsl(${14 + t * 8},${65 + t * 10}%,${42 - t * 18}%)`,
      1.8 + rng() * 2.2, 0.30 + rng() * 0.35);
  }

  // Right wall brushstrokes
  for (let i = 0; i < 200; i++) {
    const x = W - rng() * W * 0.38, y = rng() * H, t = y / H;
    stroke(ctx, x, y, 10 + rng() * 14,
      Math.PI * 0.5 + (rng() - 0.5) * 0.8 + Math.sin(y * 0.02) * 0.4,
      `hsl(${14 + t * 8},${65 + t * 10}%,${42 - t * 18}%)`,
      1.8 + rng() * 2.2, 0.30 + rng() * 0.35);
  }

  // Sky slit at top
  const sky2 = ctx.createLinearGradient(0, 0, 0, H * 0.12);
  sky2.addColorStop(0, "hsla(200,40%,72%,.85)");
  sky2.addColorStop(1, "transparent");
  ctx.fillStyle = sky2;
  ctx.beginPath(); ctx.moveTo(W * 0.28, 0);
  for (let x = W * 0.28; x <= W * 0.72; x += 4) ctx.lineTo(x, Math.sin((x - W * 0.28) / (W * 0.44) * Math.PI) * H * 0.06);
  ctx.lineTo(W * 0.72, 0); ctx.closePath(); ctx.fill();
}


/* ═══════════════════════════════════════
   6. BRUSHFIRE
   Abstract acrylic painting · impasto horizontal layers · fire in oil paint
   ═══════════════════════════════════════ */

export function drawBrushfire(cv: HTMLCanvasElement): void {
  const ctx = cv.getContext("2d")!;
  const W = cv.width, H = cv.height;
  const rng = seededRng(6666);

  // Colour bands
  const bands: [number, number, string[]][] = [
    [0.00, 0.08, ["#FEDE60", "#F8CC48", "#FAD450"]],
    [0.07, 0.17, ["#F4A028", "#F09020", "#EC8018"]],
    [0.14, 0.26, ["#E06818", "#DC5C14", "#D85010"]],
    [0.24, 0.36, ["#CC3C10", "#C4300C", "#BE280A"]],
    [0.33, 0.46, ["#A82008", "#A01A06", "#981608"]],
    [0.44, 0.58, ["#8A1008", "#820C06", "#7A0A06"]],
    [0.56, 0.70, ["#6A0808", "#5A0606", "#4A0808"]],
    [0.68, 0.82, ["#380A10", "#2C0A0E", "#200810"]],
    [0.79, 0.90, ["#1A0814", "#140612", "#100410"]],
    [0.88, 1.00, ["#160830", "#0E0628", "#201040"]],
  ];

  // Base bands
  bands.forEach(([y0, y1, cols]) => {
    const g = ctx.createLinearGradient(0, H * y0, 0, H * y1);
    g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, H * y0, W, H * (y1 - y0) + 2);
  });

  // Horizontal impasto strokes within each band
  bands.forEach(([y0, y1, cols]) => {
    const bandH = H * (y1 - y0);
    const numR = Math.floor(bandH / 5) + 2;
    for (let row = 0; row < numR; row++) {
      const y = H * y0 + row * (bandH / numR) + (rng() - 0.5) * 3;
      let x = -5;
      while (x < W + 10) {
        const len = 18 + rng() * 40;
        const w = 2.5 + rng() * 3.5;
        const col = cols[Math.floor(rng() * cols.length)];
        ctx.save();
        ctx.globalAlpha = 0.38 + rng() * 0.50;
        ctx.beginPath();
        ctx.moveTo(x, y + (rng() - 0.5) * 3);
        ctx.quadraticCurveTo(x + len * 0.5, y + w * 1.2 * (rng() < 0.5 ? 1 : -1), x + len, y + (rng() - 0.5) * 2.5);
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
        x += len * 0.6 + rng() * 8;
      }
    }
  });

  // Golden highlight streaks at top
  for (let i = 0; i < 25; i++) {
    const y = rng() * H * 0.20;
    const x = rng() * W;
    const len = 25 + rng() * 55;
    ctx.save();
    ctx.globalAlpha = 0.28 + rng() * 0.45;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + (rng() - 0.5) * 2.5);
    ctx.lineWidth = 1.5 + rng() * 1.5;
    ctx.strokeStyle = rng() < 0.5 ? "#FFFAA0" : "#FFF070";
    ctx.lineCap = "round"; ctx.stroke(); ctx.restore();
  }

  // Irregular band edges
  [0.07, 0.14, 0.24, 0.33, 0.44, 0.56, 0.68, 0.79, 0.88].forEach(yf => {
    const y = H * yf;
    for (let i = 0; i < W; i += 6) {
      const dy = (rng() - 0.5) * 8;
      ctx.fillStyle = rng() < 0.5 ? "rgba(0,0,0,.25)" : "rgba(0,0,0,.12)";
      ctx.fillRect(i, y + dy, 5 + rng() * 10, 1.5 + rng() * 2.5);
    }
  });
}


/* ── Scene registry ── */

export const SUNSET_PAINTERS: Record<string, SunsetPainter> = {
  "starry-dusk": drawStarryDusk,
  "meadow-path": drawMeadowPath,
  "wheatfield": drawWheatfield,
  "ember-wave": drawEmberWave,
  "canyon-fire": drawCanyonFire,
  "brushfire": drawBrushfire,
};
