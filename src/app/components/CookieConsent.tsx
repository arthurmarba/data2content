"use client";

import React, { useState, useEffect, useRef } from "react";

const COOKIE_CONSENT_OFFSET_VAR = "--cookie-consent-offset";

const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!isVisible || typeof window === "undefined") return;

    const updateOffset = () => {
      const height = bannerRef.current?.getBoundingClientRect().height ?? 0;
      document.documentElement.style.setProperty(
        COOKIE_CONSENT_OFFSET_VAR,
        `${Math.ceil(height)}px`,
      );
    };

    updateOffset();
    window.addEventListener("resize", updateOffset);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateOffset)
        : null;
    if (resizeObserver && bannerRef.current) {
      resizeObserver.observe(bannerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateOffset);
      resizeObserver?.disconnect();
      document.documentElement.style.removeProperty(COOKIE_CONSENT_OFFSET_VAR);
    };
  }, [isVisible]);

  const acceptCookies = () => {
    localStorage.setItem("cookie_consent", "granted");
    (window as any).gtag?.("consent", "update", {
      ad_storage: "granted",
      analytics_storage: "granted",
    });
    document.documentElement.style.removeProperty(COOKIE_CONSENT_OFFSET_VAR);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      ref={bannerRef}
      className="fixed bottom-0 left-0 right-0 z-50 bg-brand-dark text-brand-light p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <span>
        Utilizamos cookies para melhorar sua experiência. Aceita o uso de cookies?
      </span>
      <button
        onClick={acceptCookies}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
      >
        Aceitar
      </button>
    </div>
  );
};

export default CookieConsent;
