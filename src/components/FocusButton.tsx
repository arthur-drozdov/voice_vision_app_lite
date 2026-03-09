import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { isFocusActive, toggleFocus } from "@/lib/FocusController";

/**
 * Compact focus-mode toggle button.
 * Place inline inside page headers next to subheader elements.
 */
const FocusButton = () => {
  const [focus, setFocus] = useState(isFocusActive);

  useEffect(() => {
    const sync = () => setFocus(isFocusActive());
    window.addEventListener("focusmodechange", sync);
    return () => window.removeEventListener("focusmodechange", sync);
  }, []);

  return (
    <button
      onClick={() => { const s = toggleFocus(); setFocus(s); }}
      title={focus ? "Exit Focus Mode" : "Focus Mode"}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass text-[10px] font-medium transition-all ${
        focus ? "text-primary border-primary/30" : "text-foreground/70"
      }`}
    >
      {focus ? <Sun size={12} /> : <Moon size={12} />}
      {focus ? "On" : "Off"}
    </button>
  );
};

export default FocusButton;
