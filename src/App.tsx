import { useEffect, useState, Component } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

// ── Error Boundary ────────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[App] React error boundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", color: "#fff", background: "#1a1a2e", minHeight: "100vh", fontFamily: "system-ui" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Something went wrong</h1>
          <p style={{ color: "#ccc", marginBottom: "1rem" }}>The app encountered an error. Try refreshing the page.</p>
          <pre style={{ background: "#2a2a3e", padding: "1rem", borderRadius: "8px", fontSize: "0.8rem", overflow: "auto", maxHeight: "50vh" }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack?.split("\n").slice(0, 10).join("\n")}
          </pre>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ padding: "0.5rem 1rem", marginTop: "1rem", background: "#f0a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import MobileLayout from "@/components/MobileLayout";
import Index from "@/pages/Index";
import ChatAgent from "@/pages/ChatAgent";
import VideoAgent from "@/pages/VideoAgent";
import DiagramCanvas from "@/pages/DiagramCanvas";
import Customize from "@/pages/Customize";
import ChatHistory from "@/pages/ChatHistory";
import MemorySanctuary from "@/pages/MemorySanctuary";
import RecentlyDeleted from "@/pages/RecentlyDeleted";
import NotFound from "./pages/NotFound";
import { applyTheme } from "@/lib/themes";
import { isSetupComplete } from "@/lib/userProfileStore";
import WelcomeScreen from "@/components/WelcomeScreen";

// Apply theme SYNCHRONOUSLY at module load — before any React renders.
// This ensures CSS vars are set before DefaultBg's useEffect applies wallpaper overrides on top.
try {
  const saved = localStorage.getItem("customize-settings");
  if (saved) {
    const { background } = JSON.parse(saved);
    if (background) applyTheme(background);
  }
} catch { /* ignore */ }

const queryClient = new QueryClient();

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const pageTransition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] as const };

const AnimatedPage = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={pageTransition}
    className="h-full"
  >
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<AnimatedPage><Index /></AnimatedPage>} />
        <Route path="/chat" element={<AnimatedPage><ChatAgent /></AnimatedPage>} />
        <Route path="/video" element={<AnimatedPage><VideoAgent /></AnimatedPage>} />
        <Route path="/canvas" element={<AnimatedPage><DiagramCanvas /></AnimatedPage>} />
        <Route path="/customize" element={<AnimatedPage><Customize /></AnimatedPage>} />
        <Route path="/history" element={<AnimatedPage><ChatHistory /></AnimatedPage>} />
        <Route path="/memory-sanctuary" element={<AnimatedPage><MemorySanctuary /></AnimatedPage>} />
        <Route path="/recently-deleted" element={<AnimatedPage><RecentlyDeleted /></AnimatedPage>} />
        <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  const [showWelcome, setShowWelcome] = useState(!isSetupComplete());

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <MobileLayout>
              {/* Welcome screen overlay — shown on first launch, inside phone frame */}
              <AnimatePresence>
                {showWelcome && (
                  <WelcomeScreen onComplete={() => setShowWelcome(false)} />
                )}
              </AnimatePresence>
              <AnimatedRoutes />
            </MobileLayout>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

