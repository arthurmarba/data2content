// src/app/dashboard/planning/components/ProfileAnalysisFunnelOverlay.tsx
"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  Instagram, 
  Sparkles, 
  CheckCircle2, 
  UserPlus,
  Rocket,
} from "lucide-react";
import { useSession } from "next-auth/react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { startGoogleSignInForPaywall } from "@/app/lib/paywall/startGoogleSignInForPaywall";
import { startInstagramReconnect } from "@/app/lib/instagram/client/startInstagramReconnect";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

type ConversionState = "logged-out" | "no-pro" | "no-instagram";

export default function ProfileAnalysisFunnelOverlay() {
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
        : "/planning/graficos";

    if (currentState === "logged-out") {
      await startGoogleSignInForPaywall({
        context: "planning",
        source: "profile_analysis_demo_overlay",
        returnTo,
      });
    } else if (currentState === "no-pro") {
      window.dispatchEvent(
        new CustomEvent("open-subscribe-modal", {
          detail: {
            context: "planning",
            source: "profile_analysis_demo_overlay",
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
              context: "planning",
              source: "profile_analysis_demo_overlay",
              returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
              proposalId: null,
              ts: Date.now(),
            })
          );
        }
        await startInstagramReconnect({
          nextTarget: "planner",
          source: "profile_analysis_demo_overlay",
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
      title: "Análise de Perfil Estratégica",
      description: "Entenda o que postar, qual tom usar e os melhores horários baseados em dados reais.",
      cta: "Entrar com Google",
      badge: "Passo 1 de 3",
    },
    "no-pro": {
      title: "Desbloqueie sua Estratégia",
      description: "Tenha acesso aos temas, formatos e horários que mais trazem novos seguidores para você.",
      cta: "Assinar Plano Pro",
      badge: "Passo 2 de 3",
    },
    "no-instagram": {
      title: "Conecte seu Instagram",
      description: "Precisamos analisar seu histórico para gerar os gráficos de performance e tendências.",
      cta: "Conectar Instagram",
      badge: "Passo 3 de 3",
    },
  };

  const activeContent = content[currentState];

  return (
    <div className="absolute inset-0 z-50 rounded-[2.5rem] bg-white/10 backdrop-blur-[6px]">
      <div className="sticky top-12 md:top-20 mx-auto flex w-full max-w-xl flex-col items-center px-6 pt-10 md:pt-16 text-center">
        {/* Funnel Steps */}
        <div className="mb-10 flex w-full max-w-xs items-center justify-between gap-2">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1.5">
                <div 
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 ${
                    step.completed 
                      ? "bg-emerald-500 text-white" 
                      : step.active 
                        ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200" 
                        : "bg-zinc-100 text-zinc-400"
                  }`}
                >
                  {step.completed ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${step.active ? "text-zinc-900" : "text-zinc-400"}`}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="mb-4 h-px flex-1 bg-zinc-200/50" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content Section */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentState}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="rounded-3xl border border-white/80 bg-white/80 p-8 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary ring-1 ring-inset ring-brand-primary/10">
              <Sparkles className="h-3.5 w-3.5" />
              {activeContent.badge}
            </div>
            
            <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
              {activeContent.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[300px] text-[15px] leading-relaxed text-zinc-500">
              {activeContent.description}
            </p>

            <button
              onClick={handleAction}
              className="group relative mt-8 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-zinc-950 px-10 py-4 text-sm font-bold text-white transition-all hover:bg-black hover:shadow-2xl active:scale-95"
            >
              <span className="relative z-10">{activeContent.cta}</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
              <div className="absolute inset-0 -z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>
            
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
