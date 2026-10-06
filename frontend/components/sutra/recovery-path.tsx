"use client";
/**
 * RecoveryPath — ADAPTED from the Skiper 19 technique supplied in core-sutra-ui.md:
 * `useScroll` → `useTransform` → `motion.path` `pathLength` (stroke follows scroll progress).
 * The path geometry, nodes, tokens and travel semantics are Sutra's own (Skiper's demo LinePath SVG is not used).
 * Original Skiper demo imports `framer-motion`; this uses `motion/react` (same API).
 * Reduced motion: the full repaired path is rendered immediately.
 */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { placeName } from "@/lib/places";

export function RecoveryPath({ cities, label }: { cities: string[]; label: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 100%", "start 55%"] });
  const spring = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  const pathLength = useTransform(spring, [0, 1], [0.02, 1]);

  const W = 760, H = 150, pad = 56;
  const n = Math.max(cities.length, 2);
  const pts = Array.from({ length: n }, (_, i) => ({
    x: pad + (i * (W - pad * 2)) / (n - 1),
    y: 94 - Math.sin((i / (n - 1)) * Math.PI) * 48 + (i % 2 === 0 ? 6 : -4),
  }));
  const d = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const q = pts[i - 1], mx = (q.x + p.x) / 2;
    return `${acc} C ${mx} ${q.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
  }, "");
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="sutra-path" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--green-deep)" /><stop offset="55%" stopColor="var(--green)" /><stop offset="100%" stopColor="var(--blue-bright)" />
          </linearGradient>
        </defs>
        <path d={d} stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" fill="none" />
        <motion.path d={d} stroke="url(#sutra-path)" strokeWidth="4" strokeLinecap="round" fill="none" style={{ pathLength: reduce ? 1 : pathLength }} />
        <motion.path d={d} stroke="#d8ffeb" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 30" fill="none"
          animate={reduce ? undefined : { strokeDashoffset: [0, -160] }} transition={{ duration: 5.6, ease: "linear", repeat: Infinity }} />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="10" fill="var(--bg)" stroke="var(--green)" strokeWidth="2.5" />
            <circle cx={p.x} cy={p.y} r="4" fill="var(--green-bright)" />
            <text x={p.x} y={p.y + (p.y > 70 ? 30 : -18)} textAnchor="middle" className="fill-ink2" style={{ font: "500 13px var(--font-sans)" }}>
              {placeName(cities[i] ?? "")}
            </text>
          </g>
        ))}
        {!reduce && <motion.circle r="5" fill="#d8ffeb" style={{ offsetPath: `path("${d}")`, offsetDistance: "0%", offsetRotate: "auto" }}
          animate={{ offsetDistance: ["0%", "100%"] }} transition={{ duration: 5.6, ease: "linear", repeat: Infinity }} />}
      </svg>
    </div>
  );
}
