"use client";

import dynamic from "next/dynamic";

const TravelGlobe = dynamic(() => import("./travel-globe").then(module => module.TravelGlobe), {
  ssr: false,
  loading: () => <div aria-hidden className="mx-auto h-[19rem] w-full max-w-[30rem] sm:h-[24rem] lg:h-[27rem]" />,
});

export function LandingGlobe() {
  return <TravelGlobe />;
}
