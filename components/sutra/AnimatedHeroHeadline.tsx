
"use client";

import { useEffect, useState } from "react";

const phrases = ["breaks,", "is delayed,", "is cancelled,"];

export function AnimatedHeroHeadline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % phrases.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <h1
      id="home-title"
      className="mt-4 max-w-3xl font-display text-[clamp(2.35rem,5vw,4.5rem)] font-semibold leading-[.98] tracking-[-.045em] text-ink"
    >
      <span className="block whitespace-nowrap">When travel</span>

      <span className="sutra-word-slot text-green-bright">
        {phrases.map((phrase, i) => (
          <span
            key={phrase}
            aria-hidden="true"
            className={`sutra-word ${
              index === i ? "sutra-word-active" : ""
            }`}
          >
            {phrase}
          </span>
        ))}
      </span>

      <span className="block">Sutra repairs the journey.</span>
    </h1>
  );
}
