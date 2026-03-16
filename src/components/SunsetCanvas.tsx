/**
 * SunsetCanvas — Canvas 2D renderer for Van Gogh sunset subthemes
 *
 * Paints a static Van Gogh-inspired scene onto an HTML Canvas element.
 * Each subtheme has its own paint function in sunsetScenes.ts.
 * Re-paints on resize to fill the viewport cleanly.
 */

import React, { useRef, useEffect } from "react";
import { SUNSET_PAINTERS } from "@/lib/sunsetScenes";

interface Props {
  presetId: string;
}

const SunsetCanvas: React.FC<Props> = ({ presetId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const painter = SUNSET_PAINTERS[presetId];
    if (!painter) return;

    const paint = () => {
      const container = canvas.parentElement;
      if (!container) return;

      const w = container.clientWidth;
      const h = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);

      // Set canvas logical size for paint functions
      canvas.width = w * dpr;
      canvas.height = h * dpr;

      painter(canvas);
    };

    paint();

    const ro = new ResizeObserver(paint);
    ro.observe(canvas.parentElement!);

    return () => ro.disconnect();
  }, [presetId]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
};

export default SunsetCanvas;
