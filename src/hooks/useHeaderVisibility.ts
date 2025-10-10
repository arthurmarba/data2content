"use client";

import { useEffect, useState } from "react";

interface HeaderVisibilityOptions {
  disabled?: boolean;
  threshold?: number;
}

/**
 * Retorna true quando o scroll atual ultrapassa o limiar informado.
 * Útil para encolher o header em páginas longas (mídia kit, planner).
 */
export function useHeaderVisibility({ disabled, threshold = 24 }: HeaderVisibilityOptions) {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    if (disabled) return;

    let ticking = false;

    const update = () => {
      const shouldCondense = window.scrollY > threshold;
      setCondensed((prev) => (prev === shouldCondense ? prev : shouldCondense));
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [disabled, threshold]);

  return condensed;
}
