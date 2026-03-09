import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Eraser, Loader2 } from "lucide-react";

interface HandwritingCanvasProps {
  onResult: (text: string) => void;
  onClose: () => void;
}

const BACKEND_URL = import.meta.env.VITE_PYTHON_BACKEND_URL ?? "http://127.0.0.1:8080";

/**
 * Full-screen drawing canvas. The user writes with their finger or stylus,
 * then taps "Convert to text". The drawing is sent to the Python backend
 * which uses the LLM vision model to read the handwriting and return typed text.
 */
const HandwritingCanvas = ({ onResult, onClose }: HandwritingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set canvas resolution to match device pixel ratio for crisp lines
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "white";
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    isDrawing.current = true;
    const pos = getPos(e);
    lastPos.current = pos;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    // Draw a dot for taps (single points)
    ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    setHasStrokes(true);
    setError(null);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawing.current = false;
    lastPos.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasStrokes(false);
    setError(null);
  };

  const recognize = async () => {
    if (!hasStrokes) return;
    setIsRecognizing(true);
    setError(null);

    try {
      // Export canvas as PNG (actual drawing size, not DPR-scaled)
      const base64 = canvasRef.current!.toDataURL("image/png").split(",")[1];

      const res = await fetch(`${BACKEND_URL}/recognize-handwriting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();

      if (data.text && data.text.trim()) {
        onResult(data.text.trim());
      } else {
        setError("Couldn't read the writing. Try writing more clearly or larger.");
        setIsRecognizing(false);
        return;
      }
    } catch (err) {
      console.error("[HandwritingCanvas] Error:", err);
      setError("Could not connect to the backend. Make sure the Python server is running.");
      setIsRecognizing(false);
      return;
    }

    setIsRecognizing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "hsl(225, 22%, 10%)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-foreground">Write here</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use your finger or stylus — tap "Convert" when done
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl glass"
          aria-label="Close"
        >
          <X size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 mx-5 rounded-2xl overflow-hidden relative" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          style={{ cursor: "crosshair" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />

        {/* Empty state hint */}
        <AnimatePresence>
          {!hasStrokes && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <p className="text-muted-foreground/40 text-lg select-none">
                Write anything here…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-destructive text-center px-5 pt-2"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 pt-3 pb-10 shrink-0">
        {/* Clear */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={clear}
          disabled={!hasStrokes || isRecognizing}
          className="flex items-center gap-2 px-4 py-3 rounded-xl glass text-sm text-muted-foreground disabled:opacity-40"
        >
          <Eraser size={16} />
          Clear
        </motion.button>

        {/* Convert */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={recognize}
          disabled={!hasStrokes || isRecognizing}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRecognizing ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 size={16} />
              </motion.div>
              Reading your writing…
            </>
          ) : (
            <>
              <Check size={16} />
              Convert to text
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default HandwritingCanvas;
