"use client";

import { useEffect, useState } from "react";

export default function useBoardMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener?.("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener?.("change", syncViewport);
    };
  }, []);

  return isMobileViewport;
}
