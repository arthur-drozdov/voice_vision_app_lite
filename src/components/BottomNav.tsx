import { useLocation, useNavigate } from "react-router-dom";
import { Home, MessageCircle, Video, PenTool, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/chat", icon: MessageCircle, label: "Chat" },
  { path: "/video", icon: Video, label: "Video" },
  { path: "/canvas", icon: PenTool, label: "Canvas" },
  { path: "/customize", icon: Sparkles, label: "Customise" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="absolute bottom-0 left-0 right-0 z-50 border-t border-white/10"
      style={{
        background: "hsla(var(--background), 0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-1 py-1 px-3 transition-all duration-200"
            >
              <Icon
                size={20}
                style={
                  isActive
                    ? {
                        opacity: 1,
                        color: "#ffffff",
                        filter: "drop-shadow(0 0 6px hsl(var(--primary))) drop-shadow(0 0 12px hsl(var(--primary))) drop-shadow(0 0 2px hsl(var(--primary)))",
                      }
                    : { opacity: 0.8, color: "#ffffff" }
                }
              />
              <span
                className={`text-[10px] font-semibold transition-opacity duration-200`}
                style={
                  isActive
                    ? {
                        opacity: 1,
                        color: "#ffffff",
                        textShadow:
                          "0 0 4px hsl(var(--primary)), 0 0 8px hsl(var(--primary)), 0 0 16px hsl(var(--primary)), 0 0 2px rgba(255,255,255,0.6)",
                      }
                    : { opacity: 0.8, color: "#ffffff" }
                }
              >
                {tab.label}
              </span>
              {/* Active dot indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary"
                  style={{ boxShadow: "0 0 10px hsl(var(--primary)), 0 0 4px hsl(var(--primary))" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
