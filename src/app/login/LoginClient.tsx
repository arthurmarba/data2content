"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import ButtonPrimary from "@/app/landing/components/ButtonPrimary";
import {
  LEGAL_CONSENT_COOKIE_MAX_AGE_SECONDS,
  LEGAL_CONSENT_COOKIE_NAME,
} from "@/lib/auth/legalConsent";

type LoginIntentCopy = {
  badge: string;
  title: string;
  description: string;
  buttonLabel: string;
  footer: string;
};

function resolveIntentCopy(rawCallbackUrl: string | null): LoginIntentCopy {
  const defaultCopy: LoginIntentCopy = {
    badge: "Entrar com Google",
    title: "Continue na plataforma",
    description:
      "Entre com sua conta Google para acessar seus boards, salvar progresso e continuar sua jornada na Data2Content.",
    buttonLabel: "Continuar com Google",
    footer: "Sua conta conecta ferramentas, histórico e próximos passos em um só lugar.",
  };

  if (!rawCallbackUrl) {
    return defaultCopy;
  }

  let normalizedPath = rawCallbackUrl.trim();
  try {
    if (/^https?:\/\//i.test(normalizedPath)) {
      normalizedPath = new URL(normalizedPath).pathname;
    }
  } catch {
    return defaultCopy;
  }

  const path = normalizedPath.toLowerCase();

  if (path.includes("/calculator")) {
    return {
      badge: "Calculadora Pro",
      title: "Entre para continuar na calculadora",
      description:
        "Use sua conta Google para retomar a precificação e seguir para a assinatura do Plano Pro quando necessário.",
      buttonLabel: "Entrar e continuar",
      footer: "Depois do login, você volta para a calculadora sem perder a intenção original.",
    };
  }

  if (path.includes("/media-kit") || path.includes("/mediakit")) {
    return {
      badge: "Mídia Kit",
      title: "Entre para continuar no Mídia Kit",
      description:
        "A conta Google guarda seu progresso e permite seguir para a assinatura e conexão do Instagram no momento certo.",
      buttonLabel: "Entrar e continuar",
      footer: "Seu retorno continua do ponto em que você parou.",
    };
  }

  if (path.includes("/planning") || path.includes("/calendar")) {
    return {
      badge: "Planejamento",
      title: "Entre para continuar no board",
      description:
        "Faça login com Google para acessar seu board, salvar progresso e continuar o fluxo de assinatura quando a funcionalidade for premium.",
      buttonLabel: "Entrar e continuar",
      footer: "Depois do login, a plataforma retoma a etapa correta para liberar o recurso.",
    };
  }

  if (path.includes("/campaigns") || path.includes("/publis") || path.includes("/proposals")) {
    return {
      badge: "Campanhas e CRM",
      title: "Entre para continuar nas campanhas",
      description:
        "Sua conta Google é necessária para gerenciar CRM, publis e negociações, com assinatura ativada quando o recurso exigir acesso Pro.",
      buttonLabel: "Entrar e continuar",
      footer: "Login primeiro, assinatura quando necessário, sempre no mesmo fluxo.",
    };
  }

  if (path.includes("/discover") || path.includes("/community")) {
    return {
      badge: "Comunidade",
      title: "Entre para continuar na comunidade",
      description:
        "Faça login com Google para acessar a comunidade e seguir para a mentoria ou para os próximos passos de ativação quando necessário.",
      buttonLabel: "Entrar e continuar",
      footer: "Sessões gratuitas e premium seguem a partir desta mesma conta.",
    };
  }

  return defaultCopy;
}

function LoginComponent() {
  const searchParams = useSearchParams();
  const callbackUrlFromParams = searchParams.get("callbackUrl");
  const loginError = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  const copy = useMemo(
    () => resolveIntentCopy(callbackUrlFromParams),
    [callbackUrlFromParams]
  );
  const consentRequired = loginError === "TermsConsentRequired";

  const handleGoogleSignIn = () => {
    if (consentRequired && !termsAccepted) {
      setShowConsentError(true);
      return;
    }

    setIsLoading(true);
    if (consentRequired) {
      const secureFlag =
        typeof window !== "undefined" && window.location.protocol === "https:"
          ? "; Secure"
          : "";
      document.cookie = `${LEGAL_CONSENT_COOKIE_NAME}=1; Max-Age=${LEGAL_CONSENT_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureFlag}`;
    }

    void signIn("google", {
      callbackUrl: callbackUrlFromParams || MAIN_DASHBOARD_ROUTE,
    }).catch(() => {
      setIsLoading(false);
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0F1A] px-4 py-12">
      {/* Premium Dark Background with Glowing Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-brand-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-brand-accent/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />
      </div>

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-2xl">
        {/* Subtle top light effect */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="mb-10 text-center">
          <div className="inline-flex mb-6 rounded-full border border-brand-primary/20 bg-brand-primary/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary">
            {copy.badge}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            {copy.title}
          </h1>
          <p className="mt-4 text-[13px] font-medium leading-relaxed text-slate-400">
            {copy.description}
          </p>
        </div>

        {consentRequired ? (
          <div className="mb-5 rounded-2xl border border-amber-400/25 bg-amber-300/10 px-4 py-3 text-[12px] leading-relaxed text-amber-100">
            Para continuar com Google, aceite os Termos e a Política de Privacidade antes do login.
          </div>
        ) : null}

        {consentRequired ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[12px] leading-relaxed text-slate-300">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => {
                  setTermsAccepted(event.target.checked);
                  if (event.target.checked) {
                    setShowConsentError(false);
                  }
                }}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-brand-primary focus:ring-brand-primary"
              />
              <span>
                Li e concordo com os{" "}
                <Link
                  href="/termos-e-condicoes"
                  target="_blank"
                  className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:text-brand-primary"
                >
                  Termos e Condições
                </Link>{" "}
                e com a{" "}
                <Link
                  href="/politica-de-privacidade"
                  target="_blank"
                  className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:text-brand-primary"
                >
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>
            {showConsentError ? (
              <p className="mt-3 text-[11px] font-semibold text-rose-300">
                Você precisa aceitar os termos para continuar com Google.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mb-6 text-center text-[12px] leading-relaxed text-slate-400">
            Ao continuar, você poderá revisar os{" "}
            <Link
              href="/termos-e-condicoes"
              target="_blank"
              className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:text-brand-primary"
            >
              Termos e Condições
            </Link>{" "}
            e a{" "}
            <Link
              href="/politica-de-privacidade"
              target="_blank"
              className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:text-brand-primary"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        )}

        <div className="relative group">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-brand-primary/50 to-brand-accent/50 opacity-30 blur-sm group-hover:opacity-75 transition duration-500"></div>
          <ButtonPrimary
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            size="lg"
            variant="brand"
            className="relative w-full rounded-2xl !bg-white px-6 py-5 text-base font-bold !text-slate-900 shadow-xl transition-all hover:!bg-white hover:!text-slate-900 hover:scale-[1.01] active:scale-[0.98]"
          >
            <span className="inline-flex items-center justify-center gap-3">
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
          </ButtonPrimary>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {copy.footer}
          </p>
          {consentRequired ? (
            <p className="text-center text-[11px] leading-relaxed text-slate-500">
              O aceite é registrado quando você continua com Google.
            </p>
          ) : null}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent" />
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
