"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export function useMobileAutoSequence(length: number, interval = 3200) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const isInView = useInView(ref, { amount: 0.35 });
  const [isMobile, setIsMobile] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 560px)");
    const update = () => setIsMobile(media.matches);

    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!isMobile || reducedMotion || !isInView || length < 2) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setActiveIndex((current) => (current + 1) % length);
      }
    }, interval);

    return () => window.clearInterval(timer);
  }, [interval, isInView, isMobile, length, reducedMotion]);

  const selectIndex = useCallback((index: number) => {
    setActiveIndex(Math.max(0, Math.min(length - 1, index)));
  }, [length]);

  return {
    ref,
    activeIndex,
    isMobile,
    reducedMotion: Boolean(reducedMotion),
    selectIndex,
  };
}
