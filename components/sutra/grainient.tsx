"use client";

import type { CSSProperties } from "react";

type GrainientProps = {
  color1?: string;
  color2?: string;
  color3?: string;
  timeSpeed?: number;
  noiseScale?: number;
  grainAmount?: number;
  zoom?: number;
};

export function Grainient({
  color1 = "#b7b7b7",
  color2 = "#10B981",
  color3 = "#5d697b",
  timeSpeed = 0.25,
  noiseScale = 2,
  grainAmount = 0.1,
  zoom = 0.9,
}: GrainientProps) {
  const style = {
    "--grainient-color-1": color1,
    "--grainient-color-2": color2,
    "--grainient-color-3": color3,
    "--grainient-duration": `${Math.max(12, 60 / Math.max(timeSpeed, 0.01))}s`,
    "--grainient-zoom": zoom,
    "--grainient-noise-scale": `${180 / Math.max(noiseScale, 0.1)}px`,
  } as CSSProperties;

  return (
    <div className="sutra-grainient" style={style} aria-hidden>
      <div className="sutra-grainient-noise" style={{ opacity: grainAmount }} />
    </div>
  );
}
