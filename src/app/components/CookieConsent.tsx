"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const COOKIE_NAME = "cookie_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano
const COOKIE_CONSENT_OFFSET_VAR = "--cookie-consent-offset";

function getConsentCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  return match ? (match.split("=")[1] ?? null) : null;
}

function writeConsentCookie(value: "granted" | "denied") {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

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
    if (!getConsentCookie()) {
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

  const dismiss = () => {
    document.documentElement.style.removeProperty(COOKIE_CONSENT_OFFSET_VAR);
    setIsVisible(false);
  };

  const acceptCookies = () => {
    writeConsentCookie("granted");
    (window as any).gtag?.("consent", "update", {
      ad_storage: "granted",
      analytics_storage: "granted",
    });
    dismiss();
  };

  const declineCookies = () => {
    writeConsentCookie("denied");
    (window as any).gtag?.("consent", "update", {
      ad_storage: "denied",
      analytics_storage: "denied",
    });
    dismiss();
  };

  // No login page, the sign-in action already surfaces the legal text inline.
  if (!isVisible || isLoginPage) return null;

  if (isMobileStrategicProfileApp) {
    return (
      <div
        ref={bannerRef}
        className="fixed left-3 right-3 z-[180] flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm leading-5 text-white shadow-[0_12px_36px_rgba(15,23,42,0.28)] sm:left-6 sm:right-6"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
      >
        <span className="min-w-0 flex-1 text-zinc-300">
          Usamos cookies de analytics para melhorar a experiência. Aceita?
        </span>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={declineCookies}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-800"
          >
            Recusar
          </button>
          <button
            onClick={acceptCookies}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950"
          >
            Aceitar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={bannerRef}
      className="fixed bottom-0 left-0 right-0 z-50 bg-brand-dark text-brand-light p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="text-sm leading-relaxed">
        Utilizamos cookies essenciais para o funcionamento da plataforma e, com a sua autorização, cookies de analytics para melhorar a sua experiência.{" "}
        <a
          href="/politica-de-privacidade"
          className="underline opacity-80 hover:opacity-100"
        >
          Saiba mais
        </a>
        .
      </span>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={declineCookies}
          className="border border-white/30 text-white px-4 py-2 rounded text-sm hover:bg-white/10 transition"
        >
          Recusar não-essenciais
        </button>
        <button
          onClick={acceptCookies}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm transition"
        >
          Aceitar
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
