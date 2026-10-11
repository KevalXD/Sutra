"use client";

import type { ReactNode } from "react";
import { Grainient } from "./grainient";
import { Meteors } from "@/components/ui/meteors";
import { ProgressiveBlur } from "./kit";

export function AuthShell({ children }: { children: ReactNode }) {
  return <div className="relative isolate min-h-screen overflow-hidden"><Grainient color1="#07110e" color2="#123f32" color3="#172b46" timeSpeed={0.25} noiseScale={2} grainAmount={0.1} zoom={0.9} /><div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"><div className="sutra-starfield" /><Meteors number={30} /></div><ProgressiveBlur position="top" height={96} />{children}</div>;
}
