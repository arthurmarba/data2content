"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const COOKIE_CONSENT_OFFSET_VAR = "--cookie-consent-offset";

const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const isLoginPage = pathname?.startsWith("/login");
  const isMobileStrategicProfileApp =
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED === "1" &&
    (pathname?.startsWith("/dashboard/boards/mobile-strategic-profile") ||
      pathname?.startsWith("/planning/discover") ||
      pathname?.startsWith("/dashboard/discover"));

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

  // On the login page the sign-in action already implies consent (legal text is shown inline).
  // Showing the banner there competes with the only CTA on the screen.
  if (!isVisible || isLoginPage) return null;

  return (
    <div
      ref={bannerRef}
      className={
        isMobileStrategicProfileApp
          ? "fixed left-3 right-3 z-[180] flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm leading-5 text-white shadow-[0_12px_36px_rgba(15,23,42,0.28)] sm:left-6 sm:right-6"
          : isLoginPage
            ? "fixed bottom-3 left-3 right-3 z-50 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#07111f]/72 px-3 py-2 text-[11px] leading-4 text-slate-300 shadow-[0_12px_32px_rgba(0,0,0,0.2)] backdrop-blur sm:left-1/2 sm:right-auto sm:w-[min(21rem,calc(100vw-2rem))] sm:-translate-x-1/2"
          : "fixed bottom-0 left-0 right-0 z-50 bg-brand-dark text-brand-light p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      }
      style={isMobileStrategicProfileApp ? { bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" } : undefined}
    >
      <span className={isMobileStrategicProfileApp || isLoginPage ? "min-w-0 flex-1" : undefined}>
        {isLoginPage
          ? "Usamos cookies para melhorar sua experiência."
          : "Utilizamos cookies para melhorar sua experiência. Aceita o uso de cookies?"}
      </span>
      <button
        onClick={acceptCookies}
        className={
          isMobileStrategicProfileApp
            ? "shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950"
            : isLoginPage
              ? "shrink-0 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/12"
            : "bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
        }
      >
        Aceitar
      </button>
    </div>
  );
};

export default CookieConsent;
