import type { ComponentPropsWithoutRef } from "react";

type BorderGlowProps = ComponentPropsWithoutRef<"div">;
type MagicBentoProps = ComponentPropsWithoutRef<"ul">;

export function BorderGlow({ children, className, ...props }: BorderGlowProps) {
  return (
    <div className={`sutra-card sutra-border-glow ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
}

export function MagicBento({ children, className, ...props }: MagicBentoProps) {
  return (
    <ul className={`sutra-magic-bento ${className ?? ""}`} {...props}>
      {children}
    </ul>
  );
}
