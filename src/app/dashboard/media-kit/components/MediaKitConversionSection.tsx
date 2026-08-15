"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  Instagram, 
  CheckCircle2, 
  UserPlus,
  Rocket
} from "lucide-react";
import { useSession } from "next-auth/react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { startGoogleSignInForPaywall } from "@/app/lib/paywall/startGoogleSignInForPaywall";
import { startInstagramReconnect } from "@/app/lib/instagram/client/startInstagramReconnect";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

type ConversionState = "logged-out" | "no-pro" | "no-instagram";

export default function MediaKitConversionSection() {
  const { status: sessionStatus } = useSession();
  const billing = useBillingStatus();
  
  const instagramConnected = billing.instagram?.connected;
  const hasPro = billing.hasPremiumAccess;

  const currentState = useMemo<ConversionState>(() => {
    if (sessionStatus === "unauthenticated") return "logged-out";
    if (!hasPro) return "no-pro";
    return "no-instagram";
  }, [sessionStatus, hasPro]);

  const handleAction = async () => {
    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/media-kit";

    if (currentState === "logged-out") {
      await startGoogleSignInForPaywall({
        context: "media_kit",
        source: "media_kit_conversion_funnel",
        returnTo,
      });
    } else if (currentState === "no-pro") {
      window.dispatchEvent(
        new CustomEvent("open-subscribe-modal", {
          detail: {
            context: "media_kit",
            source: "media_kit_conversion_funnel",
            returnTo,
          },
        })
      );
    } else if (currentState === "no-instagram") {
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            PAYWALL_RETURN_STORAGE_KEY,
            JSON.stringify({
              context: "media_kit",
              source: "media_kit_conversion_funnel",
              returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
              proposalId: null,
              ts: Date.now(),
            })
          );
        }
        await startInstagramReconnect({
          nextTarget: "media-kit",
          source: "media_kit_conversion_funnel",
        });
      } catch (err) {
        console.error("Failed to start Instagram reconnect", err);
      }
    }
  };

  const steps = [
    {
      id: "logged-out",
      label: "Criar Conta",
      icon: UserPlus,
      active: currentState === "logged-out",
      completed: sessionStatus === "authenticated",
    },
    {
      id: "no-pro",
      label: "Plano Pro",
      icon: Rocket,
      active: currentState === "no-pro",
      completed: hasPro,
    },
    {
      id: "no-instagram",
      label: "Instagram",
      icon: Instagram,
      active: currentState === "no-instagram",
      completed: !!instagramConnected,
    },
  ];

  const content = {
    "logged-out": {
      title: "Seu Mídia Kit Profissional",
      description: "Crie um link único com suas métricas reais sincronizadas do Instagram para fechar mais publis.",
      cta: "Entrar com Google",
      badge: "Passo 1 de 3",
    },
    "no-pro": {
      title: "Desbloqueie o Modo Pro",
      description: "Acesse sugestões de preços baseadas em IA, categorias do seu perfil e exportação em PDF.",
      cta: "Assinar Plano Pro",
      badge: "Passo 2 de 3",
    },
    "no-instagram": {
      title: "Conecte seu Instagram",
      description: "Precisamos dos seus dados para gerar seu Mídia Kit automaticamente em segundos.",
      cta: "Conectar Instagram",
      badge: "Passo 3 de 3",
    },
  };

  const activeContent = content[currentState];

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-[var(--ds-color-neutral)]">
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-4 sm:px-5 sm:pt-6">
        <section className="ds-notebook-section ds-notebook-section--first">
          <p className="ds-notebook-label">Preparar Mídia Kit</p>
          <div className="mt-4 flex w-full items-start justify-between gap-2" aria-label="Etapas do Mídia Kit">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-300 ${
                    step.completed
                        ? "bg-[var(--ds-color-success-soft)] text-[var(--ds-color-success)]"
                      : step.active
                          ? "bg-[var(--ds-color-brand-soft)] text-[var(--ds-color-brand-strong)]"
                          : "bg-[var(--ds-color-neutral)] text-[var(--ds-color-text-muted)]"
                  }`}
                >
                  {step.completed ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                </div>
                  <span className={`text-[10px] font-semibold ${step.active ? "text-[var(--ds-color-ink)]" : "text-[var(--ds-color-text-muted)]"}`}>
                  {step.label}
                </span>
              </div>
                {idx < steps.length - 1 && <div className="mt-[1.1rem] h-px flex-1 bg-[var(--ds-color-line)]" />}
            </React.Fragment>
          ))}
          </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentState}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
              className="mt-8 border-t border-[var(--ds-color-line)] pt-7"
          >
              <p className="ds-notebook-label mb-3 text-[var(--ds-color-brand-strong)]">
              {activeContent.badge}
              </p>

              <h2 className="max-w-[18ch] font-display text-[1.8rem] font-bold leading-[1.02] tracking-[-0.04em] text-[var(--ds-color-ink)] sm:text-[2rem]">
              {activeContent.title}
            </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--ds-color-text-secondary)]">
              {activeContent.description}
            </p>

            <button
                type="button"
              onClick={handleAction}
                className="ds-button ds-button--primary ds-button--block group mt-8"
            >
                <span>{activeContent.cta}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
