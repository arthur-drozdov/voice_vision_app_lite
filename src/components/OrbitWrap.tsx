/**
 * OrbitWrap — Wraps a header panel with a spinning planet arm.
 *
 * Only visible in Midnight / Sunset themes. Renders a dashed orbit track rail
 * and a rotating arm with a recognisable planet (Earth, Saturn, Venus,
 * Jupiter, Neptune) that travels around the panel border.
 *
 * Usage:
 *   <OrbitWrap planet="earth">
 *     <GlassContainer ...>header content</GlassContainer>
 *   </OrbitWrap>
 */

import React from "react";

export type PlanetName = "earth" | "saturn" | "venus" | "jupiter" | "neptune";

interface OrbitWrapProps {
  planet: PlanetName;
  children: React.ReactNode;
  className?: string;
}

const OrbitWrap: React.FC<OrbitWrapProps> = ({ planet, children, className = "" }) => {
  return (
    <div className={`orbit-wrap ${className}`}>
      <div className={`planet-arm planet-arm-${planet}`}>
        <div className={`planet planet-${planet}`} />
      </div>
      {children}
    </div>
  );
};

export default OrbitWrap;
