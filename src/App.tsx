import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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
  );
};

export default App;

