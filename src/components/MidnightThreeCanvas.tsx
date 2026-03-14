/**
 * MidnightThreeCanvas.tsx
 *
 * Shared Three.js WebGL canvas for Midnight wallpaper backgrounds.
 * Accepts a presetId and loads the corresponding scene builder.
 */
import { useRef, useEffect } from "react";
import * as THREE from "three";
import type { SceneHandle } from "@/lib/midnightScenes";
import {
  createVioletNebula,
  createMoonPhases,
  createMoonGlow,
  createLavenderMist,
  createCelestialMap,
} from "@/lib/midnightScenes";

const SCENE_BUILDERS: Record<string, () => SceneHandle> = {
  "violet-nebula": createVioletNebula,
  "moon-phases": createMoonPhases,
  "moon-glow": createMoonGlow,
  "lavender-mist": createLavenderMist,
  "celestial-map": createCelestialMap,
};

interface Props {
  presetId: string;
}

const MidnightThreeCanvas: React.FC<Props> = ({ presetId }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const builder = SCENE_BUILDERS[presetId];
    if (!builder) return;

    // ─── Renderer ──────────────────────────────────────────────
    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = window.devicePixelRatio; // use exact native ratio — no cap, no fractional scaling artifacts

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      premultipliedAlpha: false, // prevents grid artifacts when compositing over CSS
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0); // transparent
    container.appendChild(renderer.domElement);

    // ─── Scene + Camera ────────────────────────────────────────
    const scene = new THREE.Scene();
    const aspect = w / h;
    // Ensure at least 2.5 units horizontal half-width (for r=0.85 moons + margin)
    const minHorizontal = 4.0;
    const frustum = Math.max(5.5, minHorizontal / aspect);
    const camera = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect,
      frustum, -frustum,
      -10, 100, // negative near to include objects at z > camera.z
    );

    // ─── Scene handle ──────────────────────────────────────────
    const handle = builder();
    handle.setup(scene, camera, aspect);

    // ─── Animation loop ────────────────────────────────────────
    let rafId: number;
    let prevTime = performance.now() / 1000;
    const clock = { elapsed: 0 };

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const now = performance.now() / 1000;
      const dt = Math.min(now - prevTime, 0.1); // clamp
      prevTime = now;
      clock.elapsed += dt;

      handle.animate(clock.elapsed, dt);
      renderer.render(scene, camera);

      // Second pass: foreground scene (e.g. Earth) — rendered on top
      if (handle.foregroundScene) {
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(handle.foregroundScene, camera);
        renderer.autoClear = true;
      }
    };
    rafId = requestAnimationFrame(tick);

    // ─── Resize ────────────────────────────────────────────────
    const onResize = () => {
      const w2 = container.clientWidth;
      const h2 = container.clientHeight;
      const a2 = w2 / h2;
      const f2 = Math.max(5.5, minHorizontal / a2);
      renderer.setSize(w2, h2);
      camera.left = -f2 * a2;
      camera.right = f2 * a2;
      camera.top = f2;
      camera.bottom = -f2;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // ─── Cleanup ───────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      handle.dispose();
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [presetId]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    />
  );
};

export default MidnightThreeCanvas;
