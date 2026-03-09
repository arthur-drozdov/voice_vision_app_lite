import { useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import ThemeBackground from "@/components/ThemeBackground";
import { isFocusActive } from "@/lib/FocusController";

const MobileLayout = ({ children }: { children: React.ReactNode }) => {
  // Restore focus-mode class on mount if user had it enabled
  useEffect(() => {
    if (isFocusActive()) {
      document.documentElement.classList.add("focus-mode");
    }
    if (localStorage.getItem("reduced-motion") === "true") {
      document.documentElement.classList.add("reduce-motion");
    }
    if (localStorage.getItem("wide-spacing") === "true") {
      document.documentElement.classList.add("wide-spacing");
    }
  }, []);

  return (
    <div className="min-h-screen max-w-lg mx-auto relative">
      {/* BackgroundLayer — z-index: 0, contained within mobile frame */}
      <div
        id="app-background"
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden
      >
        <ThemeBackground />
      </div>

      {/* ContentLayer — z-index: 1 */}
      <main className="h-screen overflow-hidden flex flex-col relative" style={{ zIndex: 1 }}>
        {children}
      </main>

      {/* OverlayLayer — z-index: 2+ (BottomNav is at z-50) */}
      <BottomNav />
    </div>
  );
};

export default MobileLayout;
