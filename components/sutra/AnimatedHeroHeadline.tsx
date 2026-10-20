"use client";

import { useEffect, useState } from "react";

const phrases = ["breaks,", "is delayed,", "is cancelled,"];

export function AnimatedHeroHeadline() {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) return;

    let exitTimer: ReturnType<typeof setTimeout>;

    const interval = window.setInterval(() => {
      setLeaving(true);

      exitTimer = setTimeout(() => {
        setIndex((current) => (current + 1) % phrases.length);
        setLeaving(false);
      }, 350);
    }, 4200);

    return () => {
      window.clearInterval(interval);
      clearTimeout(exitTimer);
    };
  }, []);

  return (
    <h1
      id="home-title"
      className="mt-4 max-w-3xl font-display text-[clamp(2.35rem,5vw,4.5rem)] font-semibold leading-[.98] tracking-[-.045em] text-ink"
    >
      <span className="block whitespace-nowrap">When travel</span>

      <span className="sutra-word-slot text-green-bright">
        <span
          key={index}
          className={`sutra-word ${
            leaving ? "sutra-word-exit" : "sutra-word-enter"
          }`}
        >
          {phrases[index]}
        </span>
      </span>

      <span className="block">Sutra repairs the journey.</span>
    </h1>
  );
}