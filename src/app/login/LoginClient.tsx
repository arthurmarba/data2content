"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  LEGAL_CONSENT_COOKIE_MAX_AGE_SECONDS,
  LEGAL_CONSENT_COOKIE_NAME,
} from "@/lib/auth/legalConsent";
import { resolveIntentCopy } from "./loginIntentCopy";

function LoginComponent() {
  const searchParams = useSearchParams();
  const callbackUrlFromParams = searchParams.get("callbackUrl");
  const intentFromParams = searchParams.get("intent");
  const loginError = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);
  const copy = useMemo(
    () => resolveIntentCopy(callbackUrlFromParams, intentFromParams),
    [callbackUrlFromParams, intentFromParams]
  );
  const consentRequired = loginError === "TermsConsentRequired";

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    const secureFlag =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${LEGAL_CONSENT_COOKIE_NAME}=1; Max-Age=${LEGAL_CONSENT_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureFlag}`;

    void signIn("google", {
      callbackUrl: callbackUrlFromParams || MAIN_DASHBOARD_ROUTE,
    }).catch(() => {
      setIsLoading(false);
    });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#101827] px-5 pb-10 pt-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-18%,rgba(236,72,153,0.30),rgba(16,24,39,0)_50%),linear-gradient(180deg,#1e0e26_0%,#101827_55%,#0D1726_100%)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.08] mix-blend-soft-light" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-1 py-8">
        <div className="mb-9 text-center">
          <div className="mb-8 text-xl font-black tracking-tight text-brand-primary">
            {copy.badge}
          </div>
          <h1 className="mx-auto max-w-[18rem] text-[2.15rem] font-bold leading-[1.05] tracking-tight text-slate-100">
            {copy.title}
          </h1>
          <p className="mx-auto mt-5 max-w-[18.5rem] text-sm font-medium leading-relaxed text-slate-300">
            {copy.description}
          </p>
        </div>

        {consentRequired ? (
          <div className="mb-5 rounded-2xl border border-amber-400/25 bg-amber-300/10 px-4 py-3 text-[12px] leading-relaxed text-amber-100">
            Continue com Google para registrar o aceite dos Termos e da Política de Privacidade.
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-[19.5rem]">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="inline-flex w-full appearance-none items-center justify-center overflow-hidden rounded-full border-0 bg-white px-6 py-5 text-base font-bold text-slate-950 shadow-[0_16px_42px_rgba(3,7,18,0.34)] outline-none transition-all hover:bg-white hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101827] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="inline-flex items-center justify-center gap-3 whitespace-nowrap">
              {!isLoading && (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M48 24.4C48 22.7 47.9 21.2 47.5 19.8H24.5V28.5H37.9C37.3 31.4 35.6 33.7 32.9 35.3V41.3H41.1C45.6 37.1 48 31.3 48 24.4Z"
                    fill="#4285F4"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M24.5 48.1C31.5 48.1 37.4 45.8 41.1 41.3L32.9 35.3C30.6 36.9 27.8 37.8 24.5 37.8C18.2 37.8 12.9 33.6 11 28H2.6V34.1C6.4 42.2 14.8 48.1 24.5 48.1Z"
                    fill="#34A853"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11 28C10.5 26.6 10.2 25.1 10.2 23.5C10.2 21.9 10.5 20.4 11 19V12.9H2.6C1 15.8 0 19.5 0 23.5C0 27.5 1 31.2 2.6 34.1L11 28Z"
                    fill="#FBBC05"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M24.5 9.2C28.2 9.2 31.8 10.6 34.5 13.1L41.3 6.6C37.4 2.9 31.5 0 24.5 0C14.8 0 6.4 5.9 2.6 12.9L11 19C12.9 13.4 18.2 9.2 24.5 9.2Z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              {isLoading ? "Entrando..." : copy.buttonLabel}
            </span>
          </button>
        </div>

        <p className="mt-5 text-center text-[12px] font-semibold leading-relaxed text-slate-300">
          {copy.footer}
        </p>

        <p className="mx-auto mt-2 max-w-[18rem] text-center text-[12px] leading-relaxed text-slate-400">
          Ao continuar, você aceita os{" "}
          <Link
            href="/termos-e-condicoes"
            target="_blank"
            className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:text-white"
          >
            Termos
          </Link>{" "}
          e a{" "}
          <Link
            href="/politica-de-privacidade"
            target="_blank"
            className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:text-white"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        {/* ── Feature preview — anchors the bottom, sets expectations ── */}
        <div className="mx-auto mt-10 w-full max-w-[19.5rem]">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            O que você vai descobrir
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Sua narrativa central",
              "Territórios com legitimidade",
              "Próximas pautas do mapa",
              "Tom e formato ideal",
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/[0.15] bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-slate-300"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginComponent />
    </Suspense>
  );
}
