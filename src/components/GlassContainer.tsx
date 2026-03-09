/**
 * GlassContainer — Reusable frosted-glass wrapper.
 *
 * Two variants:
 *   - "dark"   (default): used everywhere — darkened translucent bg
 *   - "bright": used for chat header agent display — lighter glass
 *
 * Sizes control padding:
 *   - "sm": px-3 py-2
 *   - "md": px-4 py-3 (default)
 *   - "lg": px-6 py-5
 */

import React from "react";

export interface GlassContainerProps {
  variant?: "dark" | "bright";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
  /** Pass-through HTML attributes */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
}

const variantStyles: Record<"dark" | "bright", React.CSSProperties> = {
  dark: {
    background: "rgba(10, 12, 15, 0.40)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    borderRadius: "10px",
    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.15)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  bright: {
    background: "rgba(255, 255, 255, 0.12)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.10)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
  },
};

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "px-3 py-2",
  md: "px-4 py-3",
  lg: "px-6 py-5",
};

const GlassContainer: React.FC<GlassContainerProps> = ({
  variant = "dark",
  size = "md",
  className = "",
  children,
  onClick,
  style,
}) => {
  return (
    <div
      className={`glass-container ${sizeClasses[size]} ${className}`}
      style={{ ...variantStyles[variant], ...style }}
      onClick={onClick}
      data-glass-variant={variant}
    >
      {children}
    </div>
  );
};

export default GlassContainer;
