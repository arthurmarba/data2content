"use client";

import React from "react";

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * When true, a subtle gradient overlay is rendered to mimic the landing glass surface.
   */
  showGlow?: boolean;
};

const baseClass =
  "relative overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl";

export default function GlassCard({ className = "", children, showGlow = false, ...rest }: GlassCardProps) {
  return (
    <div className={[baseClass, className].filter(Boolean).join(" ")} {...rest}>
      {showGlow ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 120% at 10% -10%, rgba(255,44,126,0.08) 0%, transparent 55%), radial-gradient(90% 120% at 90% 10%, rgba(36,107,253,0.07) 0%, transparent 60%)",
          }}
        />
      ) : null}
      <div className={showGlow ? "relative z-[1]" : undefined}>{children}</div>
    </div>
  );
}
