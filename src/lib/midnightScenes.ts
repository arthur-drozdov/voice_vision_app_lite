/**
 * midnightScenes.ts
 *
 * Faithful Three.js recreations of the Midnight theme reference images.
 * Each scene is built to match the generated PNG reference as closely as possible.
 *
 * Image analysis:
 *   Moon Phases — 9 cratered moons vertical column, strong violet bloom halos, deep vignette
 *   Violet Nebula — Orion-style multi-layer FBM, dust lanes, diffraction-spike bright stars
 *   Moon Glow — Single large cratered sphere, upper frame, breathing violet glow
 *   Lavender Mist — Aged purple parchment, full planisphere grid, 30+ golden constellations
 *   Celestial Map — Deep navy, dense starfield + Milky Way wisps, 25+ golden constellations, no compass
 */
import * as THREE from "three";

/* ── Types ── */
export interface SceneHandle {
  setup: (scene: THREE.Scene, camera: THREE.OrthographicCamera, aspect: number) => void;
  animate: (time: number, dt: number) => void;
  dispose: () => void;
  foregroundScene?: THREE.Scene;
}
export type SceneBuilder = () => SceneHandle;

/* ── Shared GLSL simplex noise + FBM ── */
const NOISE_GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+10.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0,.5,1,2);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0,i1.z,i2.z,1))+i.y+vec4(0,i1.y,i2.y,1))+i.x+vec4(0,i1.x,i2.x,1));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;return 105.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p,int oct){float v=0.,a=.5,f=1.;for(int i=0;i<8;i++){if(i>=oct)break;v+=a*snoise(p*f);f*=2.;a*=.5;}return v;}
`;

/* ── Helper: seeded PRNG ── */
function prng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/* ── Helper: glow sprite texture ── */
function glowTexture(
  size: number,
  stops: [number, string][]
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  stops.forEach(([s, col]) => g.addColorStop(s, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/* ── Helper: star field as Points (3000+ particles) ── */
function createStarField(
  count: number, spread: number, aspect: number, seed: number,
  disposables: THREE.BufferGeometry[], materials: THREE.Material[],
): THREE.Points {
  const rng = prng(seed);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (rng() - 0.5) * spread * aspect;
    positions[i * 3 + 1] = (rng() - 0.5) * spread;
    positions[i * 3 + 2] = 0.5;

    // Size distribution: mostly small, rare large
    const sizeRoll = rng();
    sizes[i] = sizeRoll < 0.40 ? 1.0 + rng() * 0.5
             : sizeRoll < 0.70 ? 1.5 + rng() * 1.0
             : sizeRoll < 0.88 ? 2.5 + rng() * 1.5
             : sizeRoll < 0.96 ? 4.0 + rng() * 2.0
             :                   6.0 + rng() * 4.0;

    phases[i] = rng() * Math.PI * 2;

    // Color: 70% white, 15% violet-tinted, 15% rose-tinted
    const colorRoll = rng();
    if (colorRoll < 0.70) {
      colors[i*3] = 1; colors[i*3+1] = 1; colors[i*3+2] = 1;
    } else if (colorRoll < 0.85) {
      colors[i*3] = 0.78; colors[i*3+1] = 0.72; colors[i*3+2] = 0.95; // violet
    } else {
      colors[i*3] = 0.95; colors[i*3+1] = 0.72; colors[i*3+2] = 0.85; // rose
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  disposables.push(geo);

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aColor;
      varying float vPhase;
      varying float vSize;
      varying vec3 vColor;
      void main() {
        vPhase = aPhase;
        vSize = aSize;
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vPhase;
      varying float vSize;
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        if (d > 1.0) discard;
        float core = 1.0 - smoothstep(0.0, 0.25, d);
        float glow = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0);

        // Diffraction spikes for large stars
        float spikes = 0.0;
        if (vSize > 5.0) {
          float ax = abs(c.x); float ay = abs(c.y);
          spikes = (exp(-ax*25.0)*exp(-ay*4.0) + exp(-ay*25.0)*exp(-ax*4.0)) * 0.5;
        }

        // Random twinkle: 3 overlapping frequencies
        float t1 = sin(uTime * 0.7 + vPhase);
        float t2 = sin(uTime * 1.3 + vPhase * 2.37);
        float t3 = sin(uTime * 2.1 + vPhase * 0.71);
        float twinkle = 0.15 + 0.85 * pow(clamp((t1+t2+t3)/3.0*0.5+0.5, 0.0, 1.0), 3.0);

        float alpha = (core * 0.95 + glow * 0.4 + spikes) * twinkle;
        gl_FragColor = vec4(vColor, clamp(alpha, 0.0, 1.0));
      }
    `,
  });
  materials.push(mat);
  return new THREE.Points(geo, mat);
}

/* ── Helper: second star layer (500 larger stars, offset twinkle) ── */
function createStarLayer2(
  aspect: number, seed: number,
  disposables: THREE.BufferGeometry[], materials: THREE.Material[],
): THREE.Points {
  const count = 500;
  const rng = prng(seed + 9999);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (rng() - 0.5) * 14 * aspect;
    positions[i * 3 + 1] = (rng() - 0.5) * 14;
    positions[i * 3 + 2] = 0.6;
    sizes[i] = 3.0 + rng() * 6.0;
    phases[i] = rng() * Math.PI * 2 + 3.5; // +3.5s offset
    const cr = rng();
    if (cr < 0.6) { colors[i*3]=1; colors[i*3+1]=1; colors[i*3+2]=1; }
    else if (cr < 0.8) { colors[i*3]=0.80; colors[i*3+1]=0.74; colors[i*3+2]=0.96; }
    else { colors[i*3]=0.96; colors[i*3+1]=0.74; colors[i*3+2]=0.88; }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  disposables.push(geo);

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize; attribute float aPhase; attribute vec3 aColor;
      varying float vPhase; varying vec3 vColor; varying float vSize;
      void main() {
        vPhase=aPhase; vColor=aColor; vSize=aSize;
        gl_PointSize=aSize;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vPhase; varying vec3 vColor; varying float vSize;
      void main() {
        float d=length(gl_PointCoord-0.5)*2.0;
        if(d>1.0) discard;
        float core=1.0-smoothstep(0.0,0.3,d);
        float glow=pow(1.0-smoothstep(0.0,1.0,d),2.0);
        // 12s cycle, +3.5s offset baked into vPhase
        float twinkle=0.45+0.55*pow(0.5+0.5*sin(uTime*0.524+vPhase),2.0);
        float alpha=(core*0.9+glow*0.35)*twinkle;
        gl_FragColor=vec4(vColor,clamp(alpha,0.0,1.0));
      }
    `,
  });
  materials.push(mat);
  return new THREE.Points(geo, mat);
}

/* ── Helper: Milky Way band (1200 clustered particles on diagonal) ── */
function createMilkyWayBand(
  aspect: number, seed: number,
  disposables: THREE.BufferGeometry[], materials: THREE.Material[],
): THREE.Points {
  const count = 1800;
  const rng = prng(seed + 5555);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  const bandAngle = 0.55; // ~32 degrees
  const cosA = Math.cos(bandAngle), sinA = Math.sin(bandAngle);

  for (let i = 0; i < count; i++) {
    // Along-band position (uniform)
    const along = (rng() - 0.5) * 16;
    // Across-band (Gaussian-ish: sum of randoms for bell curve)
    const across = (rng() + rng() + rng() - 1.5) * 1.8;
    positions[i * 3]     = along * cosA - across * sinA;
    positions[i * 3 + 1] = along * sinA + across * cosA;
    positions[i * 3 + 2] = 0.4;
    sizes[i] = 0.8 + rng() * 2.5;
    phases[i] = rng() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  disposables.push(geo);

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize; attribute float aPhase;
      varying float vPhase;
      void main() {
        vPhase=aPhase;
        gl_PointSize=aSize;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vPhase;
      void main() {
        float d=length(gl_PointCoord-0.5)*2.0;
        if(d>1.0) discard;
        float glow=pow(1.0-d,2.0);
        float twinkle=0.55+0.45*sin(uTime*0.8+vPhase);
        float alpha=glow*twinkle*0.72;
        vec3 col=mix(vec3(0.82,0.78,0.98), vec3(1.0), glow*0.5);
        gl_FragColor=vec4(col,clamp(alpha,0.0,0.7));
      }
    `,
  });
  materials.push(mat);
  return new THREE.Points(geo, mat);
}

/* ── Helper: nebula cloud sprites (5-6 soft glowing regions) ── */
function createNebulaSprites(
  aspect: number, seed: number,
  scene: THREE.Scene,
  disposables: THREE.BufferGeometry[], materials: THREE.Material[],
) {
  const rng = prng(seed + 7777);
  const nebulae = [
    { x:  0.8, y:  1.5, s: 5.0, color: "rgba(100,50,180,0.18)" },   // violet
    { x: -1.5, y: -0.8, s: 6.0, color: "rgba(180,50,120,0.14)" },   // rose
    { x:  2.0, y: -1.5, s: 4.5, color: "rgba(80,40,160,0.16)" },    // indigo
    { x: -0.5, y:  2.5, s: 5.5, color: "rgba(50,30,140,0.12)" },    // deep blue
    { x:  1.5, y:  0.0, s: 4.0, color: "rgba(130,50,170,0.15)" },   // mid violet
    { x: -2.0, y:  1.0, s: 5.0, color: "rgba(160,60,140,0.13)" },   // rose-violet
  ];

  const sprites: THREE.Sprite[] = [];
  nebulae.forEach(n => {
    const tex = glowTexture(128, [
      [0, n.color],
      [0.4, n.color.replace(/[\d.]+\)$/, "0.06)")],
      [1, "rgba(0,0,0,0)"],
    ]);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    materials.push(mat);
    const sprite = new THREE.Sprite(mat);
    const scale = n.s * (0.8 + rng() * 0.4);
    sprite.scale.set(scale * aspect, scale, 1);
    sprite.position.set(n.x * aspect * 0.5, n.y, -0.5);
    scene.add(sprite);
    sprites.push(sprite);
  });
  return sprites;
}

/* ── Helper: shooting stars (fires every 5-12s) ── */
interface ShootingStar {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  speed: number;
  angle: number;
  startX: number;
  startY: number;
  progress: number;
  nextAt: number;
  length: number;
}

function createShootingStars(
  count: number, aspect: number, seed: number,
  scene: THREE.Scene,
  disposables: THREE.BufferGeometry[], materials: THREE.Material[],
  color: number = 0xc8b0ff,
): ShootingStar[] {
  const rng = prng(seed);
  const meteors: ShootingStar[] = [];

  for (let i = 0; i < count; i++) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(6);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    disposables.push(geo);

    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false,
    });
    materials.push(mat);
    const line = new THREE.Line(geo, mat);
    scene.add(line);

    // Size class: 60% small, 30% medium, 10% large dramatic
    const sizeRoll = rng();
    let speed: number, length: number;
    if (sizeRoll < 0.60) {
      // Small — quick, subtle
      speed = 3.5 + rng() * 3.0;
      length = 1.5 + rng() * 2.0;
    } else if (sizeRoll < 0.90) {
      // Medium
      speed = 2.5 + rng() * 2.5;
      length = 4.0 + rng() * 3.0;
    } else {
      // Large dramatic — slow, spans half the screen
      speed = 1.5 + rng() * 1.5;
      length = 8.0 + rng() * 6.0;
    }

    meteors.push({
      line, mat,
      speed,
      // Avoid vertical angles: pick from [-60°,+60°] then randomly flip side
      angle: (rng() < 0.5 ? 1 : -1) * (Math.PI * (0.05 + rng() * 0.28)),
      startX: (rng() - 0.5) * 16 * aspect,
      startY: (rng() - 0.5) * 16,
      progress: -1,
      nextAt: 1 + i * 3 + rng() * 2, // stagger initial spawns
      length,
    });
  }
  return meteors;
}

function animateShootingStars(meteors: ShootingStar[], time: number, dt: number, aspect: number) {
  const rng = prng(Math.floor(time * 100));
  meteors.forEach(m => {
    if (m.progress < 0) {
      if (time >= m.nextAt) {
        m.progress = 0;
        m.startX = (Math.random() - 0.5) * 16 * aspect;
        m.startY = (Math.random() - 0.5) * 16;
        // Avoid vertical angles: pick from [-60°,+60°] then randomly flip side
        m.angle = (Math.random() < 0.5 ? 1 : -1) * (Math.PI * (0.05 + Math.random() * 0.28));

        // Randomize size class on each respawn
        const sizeRoll = Math.random();
        if (sizeRoll < 0.60) {
          m.speed = 3.0 + Math.random() * 3.0;
          m.length = 1.0 + Math.random() * 1.5;
        } else if (sizeRoll < 0.90) {
          m.speed = 2.0 + Math.random() * 2.5;
          m.length = 2.5 + Math.random() * 2.5;
        } else {
          m.speed = 1.5 + Math.random() * 1.5;
          m.length = 4.0 + Math.random() * 1.0;
        }
      }
      return;
    }

    m.progress += dt * m.speed;
    const dx = Math.cos(m.angle), dy = Math.sin(m.angle);
    const headX = m.startX + dx * m.progress * 4;
    const headY = m.startY + dy * m.progress * 4;
    const tailX = headX - dx * m.length;
    const tailY = headY - dy * m.length;

    const posAttr = m.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    posAttr.setXYZ(0, tailX, tailY, 1);
    posAttr.setXYZ(1, headX, headY, 1);
    posAttr.needsUpdate = true;

    // Brighter for larger ones
    const isLarge = m.length > 6.0;
    const maxOpacity = isLarge ? 1.0 : 0.85;
    const fade = m.progress < 0.12 ? m.progress / 0.12 : Math.max(0, 1 - (m.progress - 0.12) / (isLarge ? 0.80 : 0.65));
    m.mat.opacity = fade * maxOpacity;

    if (m.progress > 1.0) {
      m.progress = -1;
      m.mat.opacity = 0;
      m.nextAt = time + 8 + Math.random() * 4; // 8-12s interval
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. VIOLET NEBULA — Orion-style nebula
   Reference: Rich violet/magenta/pink cloud filling most of scene. Bright
   yellow-white core. Dark dust lanes. Secondary violet lobe lower-left.
   Hundreds of bright white stars with diffraction spikes. Dense field.
   ═══════════════════════════════════════════════════════════════════════════ */

export const createVioletNebula: SceneBuilder = () => {
  let nebulaPlane: THREE.Mesh;
  let starField: THREE.Points;
  let starLayer2: THREE.Points;
  let milkyWay: THREE.Points;
  let shootingStars: ShootingStar[];
  let saturnGroup: THREE.Group;
  const disposables: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  return {
    setup(scene, camera, aspect) {
      camera.position.z = 5;

      // ── Full-screen nebula shader — Orion reference ──
      const geo = new THREE.PlaneGeometry(12 * aspect, 12);
      disposables.push(geo);

      const nebulaMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uAspect: { value: aspect } },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          ${NOISE_GLSL}
          uniform float uTime;
          uniform float uAspect;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
            float t = uTime * 0.012;

            // Main cloud body — large, off-center right
            float n1 = fbm(vec3(p * 2.5 + vec2(0.2, -0.05), t), 7);
            float n2 = fbm(vec3(p * 3.8 + vec2(-1.5, 1.2), t * 0.7 + 5.0), 7);
            float n3 = fbm(vec3(p * 6.0 + vec2(2.5, -1.5), t * 1.1 + 10.0), 6);
            float n4 = fbm(vec3(p * 10.0 + vec2(-0.8, 2.5), t * 0.4 + 15.0), 5);
            float n5 = fbm(vec3(p * 1.8 + vec2(0.4, 0.6), t * 0.5 + 20.0), 6);

            // Cloud mask — big shape covering ~70% of screen
            vec2 cloudCenter = vec2(0.12, 0.05);
            float distC = length(p - cloudCenter);
            float cloudMask = smoothstep(1.5, 0.0, distC);

            // Primary cloud layers
            float cloud = smoothstep(-0.20, 0.55, n1) * cloudMask;
            float cloud2 = smoothstep(-0.10, 0.50, n2) * cloudMask;
            float wisp = smoothstep(0.05, 0.65, n3);
            float fine = smoothstep(0.10, 0.55, n4);

            // Dark dust lanes — strong absorption
            float dust = smoothstep(-0.05, 0.35, fbm(vec3(p * 4.0 + vec2(0.8, -0.3), t * 0.2), 6));
            float absorption = 1.0 - dust * 0.75 * cloudMask;

            // Secondary lobe — lower-left
            vec2 lobe2 = vec2(-0.50, -0.30);
            float lobe2Dist = length(p - lobe2);
            float lobe2Mask = smoothstep(0.65, 0.0, lobe2Dist);
            float lobe2Cloud = smoothstep(-0.15, 0.45, n5) * lobe2Mask;

            // Color palette — much more saturated than before
            vec3 deepViolet = vec3(0.12, 0.03, 0.28);
            vec3 violet     = vec3(0.40, 0.10, 0.60);
            vec3 magenta    = vec3(0.70, 0.12, 0.55);
            vec3 pink       = vec3(0.80, 0.35, 0.60);
            vec3 hotPink    = vec3(0.90, 0.25, 0.50);
            vec3 warmCore   = vec3(0.95, 0.82, 0.55);
            vec3 white      = vec3(1.0, 0.97, 0.90);

            vec3 color = deepViolet;
            color = mix(color, violet, cloud * 0.85);
            color = mix(color, magenta, cloud2 * 0.75);
            color = mix(color, pink, wisp * cloud * 0.55);
            color = mix(color, hotPink, fine * cloud2 * 0.35);
            color = mix(color, vec3(0.45, 0.08, 0.58), lobe2Cloud * 0.70);

            // Bright core glow
            float coreGlow = exp(-distC * 4.5) * 0.90;
            color = mix(color, warmCore, coreGlow * cloud);
            color = mix(color, white, coreGlow * coreGlow * 0.55);
            color *= absorption;
            color += fine * vec3(0.22, 0.08, 0.35) * cloud * 0.35;

            float alpha = clamp(cloud * 0.70 + cloud2 * 0.35 + lobe2Cloud * 0.50 + coreGlow * 0.35, 0.0, 0.92);
            gl_FragColor = vec4(color, alpha);
          }
        `,
      });
      materials.push(nebulaMat);
      nebulaPlane = new THREE.Mesh(geo, nebulaMat);
      nebulaPlane.position.z = -3;
      scene.add(nebulaPlane);

      // Dense star field + layers
      starField = createStarField(5000, 14, aspect, 42, disposables, materials);
      scene.add(starField);
      starLayer2 = createStarLayer2(aspect, 42, disposables, materials);
      scene.add(starLayer2);
      milkyWay = createMilkyWayBand(aspect, 42, disposables, materials);
      scene.add(milkyWay);
      createNebulaSprites(aspect, 42, scene, disposables, materials);
      shootingStars = createShootingStars(5, aspect, 42, scene, disposables, materials);

      // ── 3D Saturn — moved from Moon Glow ──
      saturnGroup = new THREE.Group();
      saturnGroup.rotation.z = 35 * Math.PI / 180;
      saturnGroup.rotation.x = 20 * Math.PI / 180;

      const satR = 0.90;
      const satGeo = new THREE.SphereGeometry(satR, 48, 48);
      disposables.push(satGeo);
      const satMat = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal; varying vec3 vPos; varying vec2 vUv;
          void main(){
            vNormal=normalize(normalMatrix*normal);
            vPos=position;
            vUv=uv;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
          }
        `,
        fragmentShader: `
          ${NOISE_GLSL}
          varying vec3 vNormal; varying vec3 vPos; varying vec2 vUv;
          void main(){
            float y=vUv.y;
            float warp=fbm(vec3(vPos*2.5+vec3(5.0)),3)*0.06;
            float bandY=y+warp;
            vec3 darkViolet=vec3(0.18,0.10,0.16);
            vec3 amber=vec3(0.68,0.48,0.22);
            vec3 gold=vec3(0.78,0.62,0.28);
            vec3 deepOrange=vec3(0.55,0.32,0.14);
            vec3 cream=vec3(0.75,0.68,0.40);
            float b=bandY*30.0;
            vec3 col=amber;
            col=mix(col,gold,smoothstep(0.3,0.7,sin(b)));
            col=mix(col,deepOrange,smoothstep(0.4,0.6,sin(b*0.6+1.0))*0.5);
            col=mix(col,darkViolet,smoothstep(0.55,0.65,sin(b*0.35+2.0))*0.45);
            col=mix(col,cream,smoothstep(0.7,0.9,sin(b*0.8+0.5))*0.35);
            float coarseNoise=fbm(vec3(vPos*6.0),4)*0.12;
            float fineNoise=fbm(vec3(vPos*18.0),3)*0.06;
            col+=coarseNoise+fineNoise;
            float storm=1.0-smoothstep(0.0,0.10,length(vPos.xy-vec2(0.12,-0.08)));
            col=mix(col,vec3(0.40,0.18,0.10),storm*0.55);
            vec3 ld=normalize(vec3(-0.5,0.3,1.0));
            float NdotL=max(dot(vNormal,ld),0.0);
            col*=0.15+NdotL*0.85;
            float rim=1.0-max(dot(vNormal,vec3(0,0,1)),0.0);
            col+=vec3(0.40,0.28,0.10)*pow(rim,3.5)*0.25;
            gl_FragColor=vec4(col,1.0);
          }
        `,
      });
      materials.push(satMat);
      const satMesh = new THREE.Mesh(satGeo, satMat);
      saturnGroup.add(satMesh);

      // Ring
      const ringInner = satR * 1.4;
      const ringOuter = satR * 2.4;
      const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 128);
      disposables.push(ringGeo);
      const ringMat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        uniforms: { uInner: { value: ringInner }, uOuter: { value: ringOuter } },
        vertexShader: `varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          ${NOISE_GLSL}
          uniform float uInner; uniform float uOuter;
          varying vec3 vPos;
          void main(){
            float dist=length(vPos.xy);
            float t=(dist-uInner)/(uOuter-uInner);
            float edgeFade=smoothstep(0.0,0.10,t)*smoothstep(1.0,0.90,t);
            float bRing=smoothstep(0.0,0.06,t)*smoothstep(0.48,0.38,t);
            float cassini=smoothstep(0.40,0.45,t)*smoothstep(0.55,0.50,t);
            bRing*=(1.0-cassini*0.85);
            float aRing=smoothstep(0.55,0.62,t)*smoothstep(0.98,0.88,t)*0.7;
            float brightness=bRing+aRing;
            float grain=fbm(vec3(vPos*40.0),3)*0.5+0.5;
            float fineGrain=fbm(vec3(vPos*80.0+vec3(99.0)),2)*0.5+0.5;
            brightness*=mix(0.55,1.0,grain)*mix(0.65,1.0,fineGrain);
            float holes=fbm(vec3(vPos*55.0+vec3(42.0)),2);
            if(holes<-0.15) brightness*=0.1;
            vec3 col=mix(vec3(0.50,0.68,0.75),vec3(0.72,0.82,0.88),grain*0.5+t*0.5);
            col*=brightness;
            float alpha=clamp(brightness*0.80,0.0,0.80)*edgeFade;
            gl_FragColor=vec4(col,alpha);
          }
        `,
      });
      materials.push(ringMat);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      saturnGroup.add(ringMesh);

      saturnGroup.position.set(-2.0, -2.5, -2);
      scene.add(saturnGroup);

      // Saturn halo
      const satHaloTex = glowTexture(128, [
        [0, "rgba(180,140,60,0.28)"],
        [0.3, "rgba(160,120,50,0.10)"],
        [0.6, "rgba(140,100,40,0.03)"],
        [1, "rgba(100,80,30,0)"],
      ]);
      const satHaloMat = new THREE.SpriteMaterial({
        map: satHaloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      materials.push(satHaloMat);
      const satHalo = new THREE.Sprite(satHaloMat);
      satHalo.scale.set(satR * 5, satR * 5, 1);
      satHalo.position.set(-2.0, -2.5, -2.2);
      scene.add(satHalo);
    },

    animate(time, dt) {
      (nebulaPlane.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (starField.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (starLayer2.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (milkyWay.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      animateShootingStars(shootingStars, time, dt, 1);
      // Saturn slow rotation
      saturnGroup.rotation.y = time * 0.015;
    },

    dispose() {
      disposables.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
    },
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. MOON PHASES — 9 moons top-to-bottom, only one visible at a time
   Cycles sequentially: first moon fades in, holds, fades out, next appears.
   Each at its own vertical position with huge violet bloom halo.
   ═══════════════════════════════════════════════════════════════════════════ */

export const createMoonPhases: SceneBuilder = () => {
  const moonGroups: { mesh: THREE.Mesh; glow: THREE.Sprite; mat: THREE.ShaderMaterial; glowMat: THREE.SpriteMaterial; baseY: number; haloBase: number }[] = [];
  let starField: THREE.Points;
  let starLayer2: THREE.Points;
  let milkyWay: THREE.Points;
  let shootingStars: ShootingStar[];
  const disposables: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // 9 phases — based on reference image
  // terminator = Nx*cos(phase) + Nz*sin(phase)
  //   phase < 0   → thin crescent (sliver on right edge)
  //   phase = 0   → first quarter (right half lit)
  //   phase = π/2 → full moon (entire front face lit)
  //   phase = π   → last quarter (left half lit)
  //   phase > π   → thin waning crescent (sliver on left edge)
  const PHASES = [
    { y:  4.2, r: 0.40, phase: -Math.PI*0.28 },  // thin waxing crescent (~15% lit)
    { y:  3.15, r: 0.45, phase: -Math.PI*0.10 }, // waxing crescent (~30% lit)
    { y:  2.1, r: 0.52, phase: 0 },               // first quarter (right half)
    { y:  1.05, r: 0.65, phase: Math.PI*0.25 },  // waxing gibbous (~75% lit)
    { y:  0.0, r: 0.85, phase: Math.PI*0.50 },   // FULL MOON
    { y: -1.05, r: 0.65, phase: Math.PI*0.75 },  // waning gibbous (~75% lit)
    { y: -2.1, r: 0.52, phase: Math.PI },          // last quarter (left half)
    { y: -3.15, r: 0.45, phase: Math.PI*1.10 },  // waning crescent (~30% lit)
    { y: -4.2, r: 0.40, phase: Math.PI*1.28 },   // thin waning crescent (~15% lit)
  ];

  return {
    setup(scene, camera, aspect) {
      camera.position.z = 5;

      // Full-screen background with GPU dithering (replaces CSS gradient to eliminate banding)
      const bgGeo = new THREE.PlaneGeometry(14 * aspect, 14);
      disposables.push(bgGeo);
      const bgMat = new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: { uAspect: { value: aspect } },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          uniform float uAspect;
          varying vec2 vUv;
          // Dithering — eliminates 8-bit banding
          float dither(vec2 co){
            return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453)-0.5;
          }
          void main(){
            // Radial gradient — darker to match original
            vec2 p=(vUv-vec2(0.5,0.65))*vec2(uAspect,1.0);
            float d=length(p)*1.3;
            // Deep navy blue gradient
            vec3 c1=vec3(0.06,0.08,0.16);   // dark navy center
            vec3 c2=vec3(0.035,0.05,0.12);  // deeper navy mid
            vec3 c3=vec3(0.02,0.03,0.08);   // near-black edge
            vec3 col=mix(c1,c2,smoothstep(0.0,0.5,d));
            col=mix(col,c3,smoothstep(0.4,1.0,d));
            // Strong dithering — 3x for dark gradients where banding is worst
            col+=dither(gl_FragCoord.xy)*3.0/255.0;
            gl_FragColor=vec4(col,1.0);
          }
        `,
      });
      materials.push(bgMat);
      const bgPlane = new THREE.Mesh(bgGeo, bgMat);
      bgPlane.position.z = -8;
      scene.add(bgPlane);

      // Dense star field
      starField = createStarField(10000, 14, aspect, 77, disposables, materials);
      scene.add(starField);
      starLayer2 = createStarLayer2(aspect, 77, disposables, materials);
      scene.add(starLayer2);
      milkyWay = createMilkyWayBand(aspect, 77, disposables, materials);
      scene.add(milkyWay);

      // Subtle nebula wisps
      const wispGeo = new THREE.PlaneGeometry(12 * aspect, 12);
      disposables.push(wispGeo);
      const wispMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uAspect: { value: aspect } },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          ${NOISE_GLSL}
          uniform float uTime; uniform float uAspect; varying vec2 vUv;
          // Dithering to prevent gradient banding
          float dither(vec2 co){
            return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453)-0.5;
          }
          void main(){
            vec2 p=(vUv-0.5)*vec2(uAspect,1.0);
            float n=fbm(vec3(p*2.0,uTime*0.02),5);
            float wisp=smoothstep(0.15,0.55,n)*0.12;
            vec3 col=vec3(0.08,0.15,0.30)*wisp;
            // Apply dithering to break up banding
            col+=dither(gl_FragCoord.xy)/255.0;
            gl_FragColor=vec4(col,wisp);
          }
        `,
      });
      materials.push(wispMat);
      const wispPlane = new THREE.Mesh(wispGeo, wispMat);
      wispPlane.position.z = -4;
      scene.add(wispPlane);

      // Load real NASA moon texture
      const moonTexture = new THREE.TextureLoader().load('/moon_texture.jpg');
      moonTexture.colorSpace = THREE.SRGBColorSpace;
      moonTexture.wrapS = THREE.RepeatWrapping;
      moonTexture.wrapT = THREE.ClampToEdgeWrapping;
      moonTexture.minFilter = THREE.LinearMipmapLinearFilter;
      moonTexture.magFilter = THREE.LinearFilter;

      // 9 moons — each at its vertical position, all start invisible
      PHASES.forEach((p, i) => {
        const geo = new THREE.SphereGeometry(p.r, 64, 64);
        disposables.push(geo);

        const mat = new THREE.ShaderMaterial({
          transparent: true,
          uniforms: {
            uTime: { value: 0 },
            uPhase: { value: p.phase },
            uOpacity: { value: 0.0 },
            uTexture: { value: moonTexture },
            uRotation: { value: i < 4 ? 0.5 : 0 }, // first 4 moons flipped 180°
            uZoom: { value: 1.0 },
            uOffset: { value: 0.0 },
          },
          vertexShader: `
            varying vec3 vNormal; varying vec3 vPos; varying vec2 vUv;
            void main(){
              vNormal=normalize(normalMatrix*normal);
              vPos=position;
              vUv=uv;
              gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
            }
          `,
          fragmentShader: `
            uniform float uTime; uniform float uPhase; uniform float uOpacity;
            uniform sampler2D uTexture; uniform float uRotation; uniform float uZoom; uniform float uOffset;
            varying vec3 vNormal; varying vec3 vPos; varying vec2 vUv;
            void main(){
              // Zoom + left-shift for full moon to crop baked shadows
              vec2 texUv = (vUv - 0.5) * uZoom + 0.5 + vec2(uOffset, 0.0);
              texUv.x += uRotation;
              vec3 rawTex=texture2D(uTexture,texUv).rgb;
              // Boost dark poles so moon is always a visible full circle
              float poleDist=abs(texUv.y-0.5)*2.0; // 0 at equator, 1 at poles
              float poleBoost=smoothstep(0.6,1.0,poleDist)*0.35;
              vec3 baseColor=min((rawTex+vec3(poleBoost))*1.3+vec3(0.08),vec3(1.0));

              // Phase terminator — wide, organic transition
              float terminator=vNormal.x*cos(uPhase)+vNormal.z*sin(uPhase);
              float phaseMask=smoothstep(-0.18,0.18,terminator);

              // Lit side — show brightened texture
              vec3 litColor=baseColor;

              // Dark side: earthshine — clearly visible
              vec3 darkColor=baseColor*0.25+vec3(0.04,0.05,0.07);

              // Final blend
              vec3 moonColor=mix(darkColor,litColor,phaseMask);

              // Rim glow — always visible on ALL sides to define the full circle
              float rim=1.0-max(dot(vNormal,vec3(0,0,1)),0.0);
              // Lit side: blue rim
              moonColor+=vec3(0.10,0.18,0.35)*pow(rim,3.5)*0.25*phaseMask;
              // Dark side: always-visible subtle edge so circle shape is clear
              moonColor+=vec3(0.08,0.10,0.18)*pow(rim,2.0)*0.30*(1.0-phaseMask);
              // Uniform thin edge on all sides — ensures full circle is always visible
              moonColor+=vec3(0.12,0.14,0.22)*pow(rim,6.0)*0.5;

              gl_FragColor=vec4(moonColor,uOpacity);
            }
          `,
        });
        materials.push(mat);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, p.y, 0);
        scene.add(mesh);

        // Blue halo
        const haloSize = p.r * 7;
        const haloTex = glowTexture(256, [
          [0,    "rgba(100,160,255,0.75)"],
          [0.12, "rgba(70,130,240,0.50)"],
          [0.30, "rgba(40,90,220,0.25)"],
          [0.55, "rgba(20,50,180,0.08)"],
          [1,    "rgba(10,25,120,0)"],
        ]);
        const glowMat = new THREE.SpriteMaterial({
          map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
        });
        materials.push(glowMat);
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(haloSize, haloSize, 1);
        glow.position.set(0, p.y, -0.3);
        scene.add(glow);

        moonGroups.push({ mesh, glow, mat, glowMat, baseY: p.y, haloBase: haloSize });
      });

      // Shader-based vignette — renders at full resolution, no texture grid artifacts
      const vigGeo = new THREE.PlaneGeometry(14 * aspect, 14);
      disposables.push(vigGeo);
      const vigMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uAspect: { value: aspect } },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          uniform float uAspect;
          varying vec2 vUv;
          void main(){
            vec2 p=(vUv-0.5)*vec2(uAspect,1.0);
            float d=length(p)*2.0;
            // Smooth radial darkening from edges
            float alpha=smoothstep(0.35,1.0,d)*0.95;
            gl_FragColor=vec4(vec3(0.01,0.02,0.04),alpha);
          }
        `,
      });
      materials.push(vigMat);
      const vig = new THREE.Mesh(vigGeo, vigMat);
      vig.position.z = -1; // behind moons (z=0) so it doesn't clip them
      scene.add(vig);

      shootingStars = createShootingStars(3, aspect, 77, scene, disposables, materials);
    },

    animate(time, dt) {
      (starField.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (starLayer2.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (milkyWay.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      animateShootingStars(shootingStars, time, dt, 1);

      // Cycling animation: one moon at a time, 5s visible, then next
      const cycleDuration = 5.1; // 0.8s fade-in + 3.5s hold + 0.8s fade-out
      const totalCycle = cycleDuration * moonGroups.length;
      const cycleTime = time % totalCycle;

      moonGroups.forEach(({ mesh, glow, mat, glowMat, baseY, haloBase }, i) => {
        const moonStart = i * cycleDuration;
        const localTime = cycleTime - moonStart;

        let opacity = 0;
        if (localTime >= 0 && localTime < cycleDuration) {
          if (localTime < 0.8) {
            // Fade in
            opacity = localTime / 0.8;
          } else if (localTime < 4.3) {
            // Hold visible
            opacity = 1;
          } else {
            // Fade out
            opacity = 1 - (localTime - 4.3) / 0.8;
          }
        }
        // Smooth easing
        opacity = opacity * opacity * (3 - 2 * opacity);

        mat.uniforms.uOpacity.value = opacity;
        mat.uniforms.uTime.value = time;
        glowMat.opacity = opacity;

        // Completely hide invisible moons so they don't block visible ones
        mesh.visible = opacity > 0.01;
        glow.visible = opacity > 0.01;

        // Gentle bob + rotation
        mesh.position.y = baseY + Math.sin(time * 0.3 + i) * 0.05;
        glow.position.y = mesh.position.y;
        mesh.rotation.y = time * 0.012;
        // Breathing halo
        const breathe = haloBase * (1 + Math.sin(time * 0.25) * 0.08);
        glow.scale.set(breathe, breathe, 1);
      });
    },

    dispose() {
      disposables.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
    },
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. MOON GLOW — Diffuse amethyst clouds + atmospheric depth
   Reference: Scattered purple/rose/lavender nebula cloud patches drifting
   across the scene. Dark gaps between clouds. Dense star field visible
   through gaps. Diffuse, atmospheric, moody — no single dominant object.
   ═══════════════════════════════════════════════════════════════════════════ */

export const createMoonGlow: SceneBuilder = () => {
  let cloudPlane: THREE.Mesh;
  let starField: THREE.Points;
  let starLayer2: THREE.Points;
  let milkyWay: THREE.Points;
  let shootingStars: ShootingStar[];
  let moonMesh: THREE.Mesh;
  let moonHalo: THREE.Sprite;
  let earthMesh: THREE.Mesh;
  let earthHalo: THREE.Sprite;
  let fgScene: THREE.Scene;
  const disposables: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  return {
    setup(scene, camera, aspect) {
      camera.position.z = 5;

      // ── Diffuse multi-cloud shader — matching amethyst reference ──
      const geo = new THREE.PlaneGeometry(12 * aspect, 12);
      disposables.push(geo);
      const cloudMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uAspect: { value: aspect } },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          ${NOISE_GLSL}
          uniform float uTime; uniform float uAspect; varying vec2 vUv;
          void main(){
            vec2 p=(vUv-0.5)*vec2(uAspect,1.0);
            float t=uTime*0.010;

            // Multiple separate cloud patches — NOT one big blob
            // Upper-left patch
            float c1=fbm(vec3(p*2.5+vec2(-0.3,0.4),t),7);
            float mask1=smoothstep(0.8,0.0,length(p-vec2(-0.3,0.3)));
            float cloud1=smoothstep(-0.10,0.50,c1)*mask1;

            // Upper-right wisps
            float c2=fbm(vec3(p*3.0+vec2(1.2,-0.3),t*0.8+5.0),7);
            float mask2=smoothstep(0.7,0.0,length(p-vec2(0.35,0.25)));
            float cloud2=smoothstep(-0.05,0.45,c2)*mask2;

            // Lower scattered patches
            float c3=fbm(vec3(p*2.8+vec2(0.5,1.5),t*0.6+10.0),6);
            float mask3=smoothstep(0.9,0.0,length(p-vec2(0.1,-0.3)));
            float cloud3=smoothstep(0.0,0.50,c3)*mask3;

            // Wispy tendrils
            float c4=fbm(vec3(p*4.5+vec2(-1.0,2.0),t*1.2+15.0),5);
            float wisps=smoothstep(0.20,0.55,c4)*0.35;

            // Dark dust absorption
            float dust=smoothstep(-0.1,0.3,fbm(vec3(p*5.0+vec2(2.0,-1.0),t*0.3),5));
            float absorb=1.0-dust*0.5;

            // Colors — violet, rose, lavender, deep purple (matching reference)
            vec3 deepPurple=vec3(0.10,0.04,0.22);
            vec3 violet=vec3(0.35,0.15,0.52);
            vec3 rose=vec3(0.55,0.20,0.42);
            vec3 lavender=vec3(0.45,0.30,0.55);

            vec3 color=deepPurple;
            color=mix(color,violet,cloud1*0.80);
            color=mix(color,rose,cloud2*0.65);
            color=mix(color,lavender,cloud3*0.55);
            color=mix(color,vec3(0.30,0.12,0.40),wisps);
            color*=absorb;

            float alpha=clamp(cloud1*0.55+cloud2*0.45+cloud3*0.40+wisps*0.30,0.0,0.80);
            gl_FragColor=vec4(color,alpha);
          }
        `,
      });
      materials.push(cloudMat);
      cloudPlane = new THREE.Mesh(geo, cloudMat);
      cloudPlane.position.z = -3;
      scene.add(cloudPlane);

      // Dense stars + Milky Way + nebula sprites — LOTS of stars
      starField = createStarField(14000, 14, aspect, 99, disposables, materials);
      scene.add(starField);
      starLayer2 = createStarLayer2(aspect, 99, disposables, materials);
      scene.add(starLayer2);
      milkyWay = createMilkyWayBand(aspect, 99, disposables, materials);
      scene.add(milkyWay);
      createNebulaSprites(aspect, 99, scene, disposables, materials);

      // ── Distant background planets — recognizable mini-planets ──
      const distantPlanets = [
        { // Earth — upper right area
          pos: [2.6, 1.8, -5] as const, r: 0.10,
          haloColor: "rgba(60,140,220,0.25)",
          frag: `
            ${NOISE_GLSL}
            varying vec3 vNormal; varying vec3 vPos;
            void main(){
              float n=fbm(vec3(vPos*5.0+vec3(10.0)),5);
              float land=smoothstep(0.0,0.15,n);
              vec3 ocean=vec3(0.06,0.18,0.55);
              vec3 green=vec3(0.12,0.38,0.15);
              vec3 desert=vec3(0.45,0.35,0.18);
              vec3 surface=mix(ocean,mix(green,desert,smoothstep(0.15,0.40,n)),land);
              // Ice caps
              float pole=abs(vPos.y)*6.0;
              surface=mix(surface,vec3(0.85,0.90,0.95),smoothstep(0.75,0.95,pole));
              // Clouds
              float clouds=smoothstep(0.30,0.50,fbm(vec3(vPos*8.0+vec3(50.0)),3));
              surface=mix(surface,vec3(0.90,0.92,0.95),clouds*0.4);
              vec3 ld=normalize(vec3(-0.5,0.3,1.0));
              float NdotL=max(dot(vNormal,ld),0.0);
              surface*=0.25+NdotL*0.75;
              float rim=1.0-max(dot(vNormal,vec3(0,0,1)),0.0);
              surface+=vec3(0.15,0.30,0.65)*pow(rim,3.0)*0.3;
              gl_FragColor=vec4(surface,1.0);
            }`,
        },
        { // Mars — lower left area
          pos: [2.2, -2.0, -4.5] as const, r: 0.08,
          haloColor: "rgba(200,80,40,0.22)",
          frag: `
            ${NOISE_GLSL}
            varying vec3 vNormal; varying vec3 vPos;
            void main(){
              float n=fbm(vec3(vPos*6.0+vec3(20.0)),4);
              vec3 rust=vec3(0.65,0.25,0.10);
              vec3 dark=vec3(0.35,0.15,0.08);
              vec3 sand=vec3(0.72,0.45,0.22);
              vec3 surface=mix(rust,mix(dark,sand,smoothstep(-0.2,0.3,n)),smoothstep(-0.1,0.2,n));
              // Polar ice
              float pole=abs(vPos.y)*7.0;
              surface=mix(surface,vec3(0.82,0.85,0.88),smoothstep(0.82,1.0,pole));
              vec3 ld=normalize(vec3(-0.5,0.3,1.0));
              float NdotL=max(dot(vNormal,ld),0.0);
              surface*=0.3+NdotL*0.7;
              float rim=1.0-max(dot(vNormal,vec3(0,0,1)),0.0);
              surface+=vec3(0.50,0.18,0.08)*pow(rim,3.0)*0.25;
              gl_FragColor=vec4(surface,1.0);
            }`,
        },
        { // Venus — upper left
          pos: [-2.8, 0.8, -5.5] as const, r: 0.09,
          haloColor: "rgba(220,180,80,0.25)",
          frag: `
            ${NOISE_GLSL}
            varying vec3 vNormal; varying vec3 vPos;
            void main(){
              float n=fbm(vec3(vPos*4.0+vec3(15.0)),5);
              float n2=fbm(vec3(vPos*8.0+vec3(30.0)),4);
              vec3 pale=vec3(0.72,0.58,0.32);
              vec3 cream=vec3(0.60,0.50,0.30);
              vec3 amber=vec3(0.50,0.35,0.18);
              vec3 ochre=vec3(0.42,0.30,0.15);
              // Thick swirling cloud bands
              float bands=sin(vPos.y*14.0+n*4.0)*0.5+0.5;
              vec3 surface=mix(cream,pale,bands*0.5);
              surface=mix(surface,amber,smoothstep(0.2,0.5,n)*0.5);
              surface=mix(surface,ochre,smoothstep(0.3,0.6,n2)*0.3);
              // Fine cloud detail
              surface+=vec3(0.08,0.06,0.02)*n2;
              vec3 ld=normalize(vec3(-0.5,0.3,1.0));
              float NdotL=max(dot(vNormal,ld),0.0);
              surface*=0.20+NdotL*0.80;
              float rim=1.0-max(dot(vNormal,vec3(0,0,1)),0.0);
              surface+=vec3(0.40,0.30,0.12)*pow(rim,3.0)*0.25;
              gl_FragColor=vec4(surface,1.0);
            }`,
        },
        { // Jupiter — right middle
          pos: [1.5, -0.5, -5] as const, r: 0.07,
          haloColor: "rgba(180,140,80,0.22)",
          frag: `
            ${NOISE_GLSL}
            varying vec3 vNormal; varying vec3 vPos;
            void main(){
              float y=vPos.y*15.0;
              float warp=fbm(vec3(vPos*3.0+vec3(30.0)),3)*2.0;
              float bands=sin(y+warp)*0.5+0.5;
              vec3 tan1=vec3(0.60,0.45,0.25);
              vec3 brown=vec3(0.40,0.28,0.15);
              vec3 cream=vec3(0.75,0.65,0.45);
              vec3 surface=mix(mix(tan1,brown,bands),cream,smoothstep(0.6,0.8,bands));
              // Great Red Spot
              float grs=1.0-smoothstep(0.0,0.10,length(vPos.xy-vec2(0.03,-0.02)));
              surface=mix(surface,vec3(0.60,0.20,0.10),grs*0.6);
              vec3 ld=normalize(vec3(-0.5,0.3,1.0));
              float NdotL=max(dot(vNormal,ld),0.0);
              surface*=0.3+NdotL*0.7;
              float rim=1.0-max(dot(vNormal,vec3(0,0,1)),0.0);
              surface+=vec3(0.40,0.30,0.15)*pow(rim,3.0)*0.25;
              gl_FragColor=vec4(surface,1.0);
            }`,
        },
      ];
      distantPlanets.forEach(dp => {
        const pGeo = new THREE.SphereGeometry(dp.r, 32, 32);
        disposables.push(pGeo);
        const pMat = new THREE.ShaderMaterial({
          vertexShader: `
            varying vec3 vNormal; varying vec3 vPos;
            void main(){vNormal=normalize(normalMatrix*normal);vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
          `,
          fragmentShader: dp.frag,
        });
        materials.push(pMat);
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(dp.pos[0], dp.pos[1], dp.pos[2]);
        scene.add(pMesh);

        // Tiny halo
        const phTex = glowTexture(64, [
          [0, dp.haloColor],
          [0.5, dp.haloColor.replace(/[\d.]+\)$/, "0.08)")],
          [1, dp.haloColor.replace(/[\d.]+\)$/, "0)")],
        ]);
        const phMat = new THREE.SpriteMaterial({
          map: phTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        materials.push(phMat);
        const ph = new THREE.Sprite(phMat);
        ph.scale.set(dp.r * 5, dp.r * 5, 1);
        ph.position.set(dp.pos[0], dp.pos[1], dp.pos[2] - 0.1);
        scene.add(ph);
      });

      // ── 3D Earth — in a separate foreground scene ──
      fgScene = new THREE.Scene();
      const earthR = 1.3;
      const earthGeo = new THREE.SphereGeometry(earthR, 64, 64);
      disposables.push(earthGeo);

      const earthTexture = new THREE.TextureLoader().load('/earth_bluemarble.jpg');
      earthTexture.colorSpace = THREE.SRGBColorSpace;

      const earthMat = new THREE.ShaderMaterial({
        uniforms: {
          uTexture: { value: earthTexture },
          uTime: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNormal; varying vec2 vUv;
          void main(){
            vNormal=normalize(normalMatrix*normal);
            vUv=uv;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
          }
        `,
        fragmentShader: `
          uniform sampler2D uTexture;
          varying vec3 vNormal; varying vec2 vUv;
          void main(){
            vec3 col=texture2D(uTexture,vUv).rgb;
            // Boost texture brightness
            col=min(col*1.5+vec3(0.1),vec3(1.0));
            // Directional sunlight — lit from upper-left
            vec3 sunDir=normalize(vec3(-0.6,0.4,0.7));
            float sunLight=max(dot(vNormal,sunDir),0.0);
            col*=0.35+sunLight*0.65;
            // Natural limb darkening at edges
            float facing=max(dot(vNormal,vec3(0,0,1)),0.0);
            float limbDark=smoothstep(0.0,0.6,facing);
            col*=mix(0.2,1.0,limbDark);
            // Atmosphere rim glow — follows sunlight direction
            float rim=1.0-facing;
            float litSide=0.3+0.7*max(dot(vNormal,sunDir),0.0);
            col+=vec3(0.25,0.45,0.9)*pow(rim,2.5)*0.30*litSide;
            col+=vec3(0.4,0.65,1.0)*pow(rim,6.0)*0.50*litSide;
            // Faint glow on shadow side too
            col+=vec3(0.1,0.15,0.3)*pow(rim,4.0)*0.15;
            gl_FragColor=vec4(col,1.0);
          }
        `,
      });
      materials.push(earthMat);
      earthMesh = new THREE.Mesh(earthGeo, earthMat);
      earthMesh.position.set(-2.0, -2.1, 0);
      fgScene.add(earthMesh);

      // Blue-white atmosphere halo
      const earthHaloTex = glowTexture(128, [
        [0, "rgba(100,160,255,0.35)"],
        [0.2, "rgba(80,140,240,0.18)"],
        [0.5, "rgba(50,100,200,0.06)"],
        [1, "rgba(30,60,150,0)"],
      ]);
      const earthHaloMat = new THREE.SpriteMaterial({
        map: earthHaloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      materials.push(earthHaloMat);
      earthHalo = new THREE.Sprite(earthHaloMat);
      earthHalo.scale.set(earthR * 5, earthR * 5, 1);
      earthHalo.position.set(-2.0, -2.1, -0.2);
      fgScene.add(earthHalo);

      // ── 3D Moon — prominent, upper-right, BIG — real-time phase! ──
      // Calculate real moon phase from current date
      // Reference: Jan 6, 2000 18:14 UTC was a known new moon
      const SYNODIC_PERIOD = 29.53058770576; // days
      const REF_NEW_MOON = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)).getTime();
      const nowMs = Date.now();
      const daysSinceRef = (nowMs - REF_NEW_MOON) / (1000 * 60 * 60 * 24);
      const lunarFraction = ((daysSinceRef % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD / SYNODIC_PERIOD;
      // Map fraction to phase angle: 0=new moon, PI=full moon, 2PI=new moon
      const realPhase = lunarFraction * Math.PI * 2;

      // Load real NASA moon texture (same as Moon Phases)
      const moonTexture = new THREE.TextureLoader().load('/moon_texture.jpg');
      moonTexture.colorSpace = THREE.SRGBColorSpace;
      moonTexture.wrapS = THREE.RepeatWrapping;
      moonTexture.wrapT = THREE.ClampToEdgeWrapping;
      moonTexture.minFilter = THREE.LinearMipmapLinearFilter;
      moonTexture.magFilter = THREE.LinearFilter;

      const moonR = 1.5;
      const moonGeo = new THREE.SphereGeometry(moonR, 64, 64);
      disposables.push(moonGeo);
      const moonMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: realPhase },
          uTexture: { value: moonTexture },
        },
        vertexShader: `
          varying vec3 vNormal; varying vec3 vPos; varying vec2 vUv;
          void main(){
            vNormal=normalize(normalMatrix*normal);
            vPos=position;
            vUv=uv;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
          }
        `,
        fragmentShader: `
          uniform float uTime; uniform float uPhase;
          uniform sampler2D uTexture;
          varying vec3 vNormal; varying vec3 vPos; varying vec2 vUv;
          void main(){
            // Sample real NASA moon texture — zoomed in to crop dark edges
            vec2 texUv = (vUv - 0.5) * 0.6 + 0.5;
            vec3 rawTex=texture2D(uTexture,texUv).rgb;
            vec3 baseColor=min(rawTex*1.3+vec3(0.08),vec3(1.0));

            // Phase terminator — biased to give wider lit crescent
            float terminator=vNormal.x*cos(uPhase)+vNormal.z*sin(uPhase)+0.15;
            float phaseMask=smoothstep(-0.18,0.18,terminator);

            // Lit side
            vec3 litColor=baseColor;

            // Dark side: earthshine
            vec3 darkColor=baseColor*0.25+vec3(0.04,0.05,0.07);

            // Blend
            vec3 moonColor=mix(darkColor,litColor,phaseMask);

            // Rim glow — purple for Moon Glow theme
            float rim=1.0-max(dot(vNormal,vec3(0,0,1)),0.0);
            vec3 litRim=vec3(0.50,0.30,0.80)*0.40;
            vec3 darkRim=vec3(0.12,0.10,0.18)*0.25;
            moonColor+=mix(darkRim,litRim,phaseMask)*pow(rim,3.5);

            gl_FragColor=vec4(moonColor,1.0);
          }
        `,
      });
      materials.push(moonMat);
      moonMesh = new THREE.Mesh(moonGeo, moonMat);
      moonMesh.position.set(2.0, 2.5, 0);
      scene.add(moonMesh);

      // Moon halo — large violet glow
      const haloSize = moonR * 5;
      const haloTex = glowTexture(256, [
        [0,    "rgba(180,130,255,0.70)"],
        [0.15, "rgba(160,100,240,0.45)"],
        [0.35, "rgba(130,70,220,0.20)"],
        [0.6,  "rgba(90,40,180,0.06)"],
        [1,    "rgba(50,20,120,0)"],
      ]);
      const haloMat = new THREE.SpriteMaterial({
        map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      materials.push(haloMat);
      moonHalo = new THREE.Sprite(haloMat);
      moonHalo.scale.set(haloSize, haloSize, 1);
      moonHalo.position.set(2.0, 2.5, -0.3);
      scene.add(moonHalo);

      shootingStars = createShootingStars(3, aspect, 99, scene, disposables, materials);
    },

    animate(time, dt) {
      (cloudPlane.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (starField.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (starLayer2.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (milkyWay.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (moonMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      animateShootingStars(shootingStars, time, dt, 1);

      // Moon bob + rotation
      const y = 2.2 + Math.sin(time * 0.25) * 0.08;
      moonMesh.position.y = y;
      moonHalo.position.y = y;
      moonMesh.rotation.y = time * 0.01;
      // Breathing halo
      const breathe = 1.8 * 5 * (1 + Math.sin(time * 0.2) * 0.10);
      moonHalo.scale.set(breathe, breathe, 1);

      // Earth slow rotation
      earthMesh.rotation.y = time * 0.06;
      (earthMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      const earthBreathe = 0.85 * 5 * (1 + Math.sin(time * 0.15) * 0.08);
      earthHalo.scale.set(earthBreathe, earthBreathe, 1);
    },

    dispose() {
      disposables.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
    },

    get foregroundScene() { return fgScene; },
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. LAVENDER MIST — Antique golden star chart on aged parchment
   Reference: Warm aged purple-lavender parchment. Heavy grain, cracks, and
   age patches. Large circular planisphere grid in golden lines. 50+ golden
   constellation patterns with glowing amber nodes. Bright central star.
   Dark vignette corners. ALL effects in GOLDEN/AMBER tones.
   ═══════════════════════════════════════════════════════════════════════════ */

function generateConstellations(count: number, spread: number, seed: number) {
  const rng = prng(seed);
  const constellations: { stars: [number, number][]; lines: [number, number][]; pos: [number, number] }[] = [];

  // Real constellation patterns — normalized coordinates, true star positions
  const shapes = [
    // Orion — hourglass with 3-star belt
    { s: [[.45,0],[.05,.15],[0,.55],[.25,.45],[.45,.45],[.65,.45],[.90,.55],[1.0,.15],[.55,0],[.45,.85],[.55,.85]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0],[3,9],[5,10]] },
    // Big Dipper (Ursa Major) — ladle shape
    { s: [[0,.4],[.3,.25],[.55,.35],[.45,.55],[.7,.5],[.95,.45],[1.2,.55]], l: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
    // Cassiopeia — W shape
    { s: [[0,.5],[.3,0],[.6,.45],[.9,0],[1.2,.5]], l: [[0,1],[1,2],[2,3],[3,4]] },
    // Leo — sickle (head) + triangle (body)
    { s: [[0,.6],[.15,.3],[.35,0],[.5,.15],[.55,.35],[.45,.55],[.85,.55],[1.0,.35],[.85,.15]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[5,6],[6,7],[7,8]] },
    // Scorpius — J-hook with curved tail
    { s: [[.1,0],[.3,.05],[.5,.15],[.55,.35],[.5,.55],[.35,.7],[.25,.85],[.35,.95],[.5,1.0]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]] },
    // Cygnus / Northern Cross
    { s: [[.5,0],[.5,.35],[.5,.7],[.5,1.0],[0,.35],[1.0,.35]], l: [[0,1],[1,2],[2,3],[4,1],[1,5]] },
    // Gemini — parallel twins
    { s: [[0,0],[.15,.3],[.25,.55],[.35,.8],[.6,0],[.55,.3],[.5,.55],[.45,.8]], l: [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[1,5],[2,6]] },
    // Lyra — parallelogram with bright star
    { s: [[.45,0],[.2,.4],[.0,.7],[.4,.65],[.7,.7],[.9,.4]], l: [[0,1],[0,5],[1,2],[2,3],[3,4],[4,5],[3,1]] },
    // Crux / Southern Cross
    { s: [[.5,0],[.5,.45],[.5,.9],[.15,.45],[.85,.45]], l: [[0,1],[1,2],[3,1],[1,4]] },
    // Corona Borealis — arc/crown
    { s: [[0,.3],[.2,.05],[.5,0],[.8,.05],[1.0,.3],[.75,.20],[.25,.20]], l: [[0,1],[1,2],[2,3],[3,4],[1,6],[3,5]] },
    // Aquila — arrow/eagle
    { s: [[.5,0],[.3,.3],[.5,.5],[.7,.3],[.0,.5],[1.0,.5]], l: [[0,1],[0,3],[1,2],[3,2],[1,4],[3,5]] },
    // Canis Major — dog with Sirius
    { s: [[.35,0],[.5,.25],[.35,.45],[.15,.65],[.0,.9],[.65,.45],[.85,.65],[.95,.45]], l: [[0,1],[1,2],[2,3],[3,4],[1,5],[5,6],[5,7]] },
    // Boötes — kite shape
    { s: [[.5,0],[.2,.3],[.15,.65],[.5,.9],[.85,.65],[.8,.3]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]] },
    // Draco — zigzag dragon
    { s: [[0,.15],[.25,.05],[.45,.2],[.55,.4],[.45,.6],[.6,.75],[.8,.65],[.9,.45]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]] },
  ];

  for (let i = 0; i < count; i++) {
    const shape = shapes[Math.floor(rng() * shapes.length)];
    const x = (rng() - 0.5) * spread * 2;
    const y = (rng() - 0.5) * spread * 2;
    const scale = 0.25 + rng() * 0.45;
    const rot = rng() * Math.PI * 2;

    const stars: [number, number][] = shape.s.map(([sx, sy]) => {
      const rx = (sx - 0.5) * scale;
      const ry = (sy - 0.5) * scale;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      return [rx * cr - ry * sr, rx * sr + ry * cr] as [number, number];
    });

    constellations.push({
      stars,
      lines: shape.l as [number, number][],
      pos: [x, y],
    });
  }
  return constellations;
}

export const createLavenderMist: SceneBuilder = () => {
  let bgPlane: THREE.Mesh;
  let gridGroup: THREE.Group;
  let shootingStars: ShootingStar[];
  const disposables: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  return {
    setup(scene, camera, aspect) {
      camera.position.z = 5;

      // ── Warm aged parchment background — distinctly warmer than Celestial Map ──
      const bgGeo = new THREE.PlaneGeometry(12 * aspect, 12);
      disposables.push(bgGeo);
      const bgMat = new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uAspect: { value: aspect } },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          ${NOISE_GLSL}
          uniform float uTime; uniform float uAspect; varying vec2 vUv;
          void main(){
            vec2 p=(vUv-0.5)*vec2(uAspect,1.0);
            // Heavy parchment grain
            float grain1=fbm(vec3(p*15.0,0.0),5)*0.10;
            float grain2=fbm(vec3(p*8.0,3.0),4)*0.08;
            float patch=snoise(vec3(p*3.0,7.0))*0.06;
            float cracks=smoothstep(0.4,0.5,abs(fbm(vec3(p*20.0,1.0),3)))*0.04;
            // Warm purple-lavender base
            vec3 base=vec3(0.28,0.18,0.38);
            base+=grain1+grain2+patch;
            base-=cracks;
            // Warm tint — important for parchment feel
            base+=vec3(0.04,0.01,-0.02);
            // Vignette
            float vig=smoothstep(0.4,1.4,length(p*1.1));
            base=mix(base,vec3(0.06,0.03,0.10),vig*0.70);
            gl_FragColor=vec4(base,1.0);
          }
        `,
      });
      materials.push(bgMat);
      bgPlane = new THREE.Mesh(bgGeo, bgMat);
      bgPlane.position.z = -5;
      scene.add(bgPlane);

      // ── Planisphere grid — golden circles + radial lines ──
      gridGroup = new THREE.Group();
      const gridColor = 0xd4b060;

      // Concentric circles — 8 rings
      for (let i = 1; i <= 8; i++) {
        const radius = i * 0.45;
        const pts: THREE.Vector3[] = [];
        const segs = 96;
        for (let j = 0; j <= segs; j++) {
          const a = (j / segs) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
        }
        const gridGeo = new THREE.BufferGeometry().setFromPoints(pts);
        disposables.push(gridGeo);
        const gridMat = new THREE.LineBasicMaterial({
          color: gridColor, transparent: true, opacity: 0.22 + (i < 3 ? 0.12 : 0),
        });
        materials.push(gridMat);
        gridGroup.add(new THREE.Line(gridGeo, gridMat));
      }

      // 12 radial lines
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0)];
        const gridGeo = new THREE.BufferGeometry().setFromPoints(pts);
        disposables.push(gridGeo);
        const gridMat = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.18 });
        materials.push(gridMat);
        gridGroup.add(new THREE.LineSegments(gridGeo, gridMat));
      }
      gridGroup.position.z = -1;
      scene.add(gridGroup);

      // ── 50 golden constellations ──
      const constellations = generateConstellations(50, 3.2, 123);
      const nodeTex = glowTexture(32, [
        [0, "rgba(240,210,100,0.95)"],
        [0.25, "rgba(220,190,80,0.5)"],
        [0.6, "rgba(190,150,50,0.12)"],
        [1, "rgba(160,120,30,0)"],
      ]);

      constellations.forEach(c => {
        c.lines.forEach(([a, b]) => {
          const pts = [
            new THREE.Vector3(c.pos[0] + c.stars[a][0], c.pos[1] + c.stars[a][1], 0),
            new THREE.Vector3(c.pos[0] + c.stars[b][0], c.pos[1] + c.stars[b][1], 0),
          ];
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          disposables.push(geo);
          const mat = new THREE.LineBasicMaterial({ color: 0xd4b060, transparent: true, opacity: 0.50 });
          materials.push(mat);
          scene.add(new THREE.Line(geo, mat));
        });
        c.stars.forEach(([sx, sy]) => {
          const nodeMat = new THREE.SpriteMaterial({
            map: nodeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
          });
          materials.push(nodeMat);
          const node = new THREE.Sprite(nodeMat);
          const nodeSize = 0.10 + Math.random() * 0.12;
          node.scale.set(nodeSize, nodeSize, 1);
          node.position.set(c.pos[0] + sx, c.pos[1] + sy, 0.1);
          scene.add(node);
        });
      });

      // Bright center star
      const centerTex = glowTexture(64, [
        [0, "rgba(255,235,160,1)"],
        [0.1, "rgba(245,210,110,0.7)"],
        [0.3, "rgba(220,180,70,0.3)"],
        [0.6, "rgba(180,140,50,0.08)"],
        [1, "rgba(140,100,30,0)"],
      ]);
      const centerMat = new THREE.SpriteMaterial({
        map: centerTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      materials.push(centerMat);
      const center = new THREE.Sprite(centerMat);
      center.scale.set(0.8, 0.8, 1);
      center.position.set(0, 0, 0.2);
      scene.add(center);

      // Golden shooting stars
      shootingStars = createShootingStars(3, aspect, 123, scene, disposables, materials, 0xd4b080);
    },

    animate(time, dt) {
      (bgPlane.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      gridGroup.rotation.z = time * 0.008;
      animateShootingStars(shootingStars, time, dt, 1);
    },

    dispose() {
      disposables.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
    },
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. CELESTIAL MAP — Deep navy + dense golden constellations + Milky Way
   Reference: Very deep navy-violet background. Extremely dense star field
   with visible Milky Way wisps. 25+ constellations with golden lines cycling
   in groups. Large planisphere grid. Compass rose bottom-right.
   ═══════════════════════════════════════════════════════════════════════════ */

export const createCelestialMap: SceneBuilder = () => {
  let milkyWayPlane: THREE.Mesh;
  let starField: THREE.Points;
  let starLayer2: THREE.Points;
  let milkyWay: THREE.Points;
  let shootingStars: ShootingStar[];
  let gridGroup: THREE.Group;
  const groupData: { lineMats: THREE.LineBasicMaterial[]; pointMat: THREE.SpriteMaterial[]; groupIdx: number }[] = [];
  const disposables: THREE.BufferGeometry[] = [];
  const allMaterials: THREE.Material[] = [];

  return {
    setup(scene, camera, aspect) {
      camera.position.z = 5;

      // ── Deep navy-violet background with Milky Way wisps ──
      const mwGeo = new THREE.PlaneGeometry(12 * aspect, 12);
      disposables.push(mwGeo);
      const mwMat = new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uAspect: { value: aspect } },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          ${NOISE_GLSL}
          uniform float uTime; uniform float uAspect; varying vec2 vUv;
          void main(){
            vec2 p=(vUv-0.5)*vec2(uAspect,1.0);
            float t=uTime*0.008;
            // Deep navy base
            vec3 base=vec3(0.04,0.03,0.10);
            // Milky Way diagonal wisp — prominent
            float angle=0.55;
            float ca=cos(angle),sa=sin(angle);
            vec2 rotP=vec2(p.x*ca+p.y*sa, -p.x*sa+p.y*ca);
            float band=exp(-rotP.y*rotP.y*3.0);
            float bandNoise=fbm(vec3(rotP*3.0,t),6);
            float wisp=band*smoothstep(-0.1,0.5,bandNoise)*0.20;
            base+=vec3(0.08,0.06,0.18)*wisp;
            // Subtle nebula tint upper-left
            float n=fbm(vec3(p*2.0+vec2(-1.0,0.5),t*0.5),5);
            float nebulaHaze=smoothstep(0.1,0.5,n)*0.08;
            base+=vec3(0.10,0.04,0.20)*nebulaHaze;
            // Vignette
            float vig=smoothstep(0.3,1.3,length(p*1.05));
            base=mix(base,vec3(0.02,0.01,0.06),vig*0.55);
            gl_FragColor=vec4(base,1.0);
          }
        `,
      });
      allMaterials.push(mwMat);
      milkyWayPlane = new THREE.Mesh(mwGeo, mwMat);
      milkyWayPlane.position.z = -4;
      scene.add(milkyWayPlane);

      // Dense star field
      starField = createStarField(6000, 14, aspect, 33, disposables, allMaterials);
      scene.add(starField);
      starLayer2 = createStarLayer2(aspect, 33, disposables, allMaterials);
      scene.add(starLayer2);
      milkyWay = createMilkyWayBand(aspect, 33, disposables, allMaterials);
      scene.add(milkyWay);

      // ── Planisphere grid ──
      gridGroup = new THREE.Group();
      const gridColor = 0xd4b060;
      for (let i = 1; i <= 8; i++) {
        const r = i * 0.48;
        const pts: THREE.Vector3[] = [];
        for (let j = 0; j <= 96; j++) {
          const a = (j / 96) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
        }
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        disposables.push(g);
        const m = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.18 });
        allMaterials.push(m);
        gridGroup.add(new THREE.Line(g, m));
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 3.84, Math.sin(a) * 3.84, 0)];
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        disposables.push(g);
        const m = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.14 });
        allMaterials.push(m);
        gridGroup.add(new THREE.LineSegments(g, m));
      }
      gridGroup.position.z = -1;
      scene.add(gridGroup);

      // ── 3 cycling constellation groups (25+ total) ──
      const constGroups = [
        generateConstellations(9, 2.8, 201),
        generateConstellations(9, 2.8, 302),
        generateConstellations(9, 2.8, 403),
      ];

      const nodeTex = glowTexture(32, [
        [0, "rgba(240,210,100,0.95)"],
        [0.25, "rgba(220,190,80,0.5)"],
        [0.6, "rgba(190,150,50,0.12)"],
        [1, "rgba(160,120,30,0)"],
      ]);

      constGroups.forEach((group, groupIdx) => {
        const lineMats: THREE.LineBasicMaterial[] = [];
        const pointMat: THREE.SpriteMaterial[] = [];

        group.forEach(c => {
          c.lines.forEach(([a, b]) => {
            const pts = [
              new THREE.Vector3(c.pos[0] + c.stars[a][0], c.pos[1] + c.stars[a][1], 0),
              new THREE.Vector3(c.pos[0] + c.stars[b][0], c.pos[1] + c.stars[b][1], 0),
            ];
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            disposables.push(geo);
            const mat = new THREE.LineBasicMaterial({ color: 0xd4b060, transparent: true, opacity: 0 });
            allMaterials.push(mat);
            lineMats.push(mat);
            scene.add(new THREE.Line(geo, mat));
          });
          c.stars.forEach(([sx, sy]) => {
            const mat = new THREE.SpriteMaterial({
              map: nodeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
            });
            allMaterials.push(mat);
            pointMat.push(mat);
            const node = new THREE.Sprite(mat);
            const s = 0.09 + Math.random() * 0.11;
            node.scale.set(s, s, 1);
            node.position.set(c.pos[0] + sx, c.pos[1] + sy, 0.1);
            scene.add(node);
          });
        });

        groupData.push({ lineMats, pointMat, groupIdx });
      });

      // Compass rose sprite — bottom right
      const compassTex = glowTexture(128, [
        [0, "rgba(212,176,96,0.70)"],
        [0.3, "rgba(200,160,80,0.30)"],
        [0.6, "rgba(180,140,60,0.08)"],
        [1, "rgba(140,100,30,0)"],
      ]);
      const compassMat = new THREE.SpriteMaterial({
        map: compassTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      allMaterials.push(compassMat);
      const compass = new THREE.Sprite(compassMat);
      compass.scale.set(1.2, 1.2, 1);
      compass.position.set(2.5 * aspect * 0.45, -2.5, 0.2);
      scene.add(compass);

      // Shader-based vignette — no texture grid artifacts
      const vigGeo = new THREE.PlaneGeometry(14 * aspect, 14);
      disposables.push(vigGeo);
      const vigMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uAspect: { value: aspect } },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          uniform float uAspect;
          varying vec2 vUv;
          void main(){
            vec2 p=(vUv-0.5)*vec2(uAspect,1.0);
            float d=length(p)*2.0;
            float alpha=smoothstep(0.5,1.0,d)*0.55;
            gl_FragColor=vec4(vec3(0.02,0.01,0.04),alpha);
          }
        `,
      });
      allMaterials.push(vigMat);
      const vig = new THREE.Mesh(vigGeo, vigMat);
      vig.position.z = 2;
      scene.add(vig);

      shootingStars = createShootingStars(4, aspect, 33, scene, disposables, allMaterials);
    },

    animate(time, dt) {
      (starField.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (starLayer2.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (milkyWay.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      (milkyWayPlane.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      animateShootingStars(shootingStars, time, dt, 1);
      gridGroup.rotation.z = time * 0.006;

      // Cycling constellation groups — smooth fade in/out
      const cycleDuration = 14;
      const totalCycle = cycleDuration * 3;
      const t = time % totalCycle;

      groupData.forEach(({ lineMats, pointMat, groupIdx }) => {
        const groupStart = groupIdx * cycleDuration;
        const relT = ((t - groupStart) + totalCycle) % totalCycle;
        let opacity: number;
        if (relT < cycleDuration * 0.15) {
          opacity = relT / (cycleDuration * 0.15);
        } else if (relT < cycleDuration * 0.85) {
          opacity = 1;
        } else if (relT < cycleDuration) {
          opacity = 1 - (relT - cycleDuration * 0.85) / (cycleDuration * 0.15);
        } else {
          opacity = 0;
        }
        opacity *= 0.70;

        lineMats.forEach(m => { m.opacity = opacity * 0.5; });
        pointMat.forEach(m => { m.opacity = opacity; });
      });
    },

    dispose() {
      disposables.forEach(g => g.dispose());
      allMaterials.forEach(m => m.dispose());
    },
  };
};
