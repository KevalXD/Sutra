import type { CSSProperties } from "react";

type MeteorStyle = CSSProperties & {
  "--meteor-duration": string;
  "--meteor-delay": string;
};

export function Meteors({ number = 20 }: { number?: number }) {
  return (
    <div className="sutra-meteors" aria-hidden>
      {Array.from({ length: number }, (_, index) => {
        const style: MeteorStyle = {
          top: `${(index * 47) % 120}%`,
          left: `${(index * 71) % 120}%`,
          "--meteor-duration": `${2 + (index % 7)}s`,
          "--meteor-delay": `${-((index % 9) * 0.6)}s`,
        };
        return <span key={index} className="sutra-meteor" style={style} />;
      })}
    </div>
  );
}
