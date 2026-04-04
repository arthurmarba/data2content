"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  Instagram, 
  Lock, 
  Sparkles, 
  CheckCircle2, 
  UserPlus,
  Rocket,
  Layout
} from "lucide-react";
import { useSession } from "next-auth/react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { startGoogleSignInForPaywall } from "@/app/lib/paywall/startGoogleSignInForPaywall";
import { startInstagramReconnect } from "@/app/lib/instagram/client/startInstagramReconnect";

type ConversionState = "logged-out" | "no-pro" | "no-instagram";

export default function PublisConversionSection() {
  const { data: session, status: sessionStatus } = useSession();
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
        : "/dashboard/publis";

    if (currentState === "logged-out") {
      await startGoogleSignInForPaywall({
        context: "publis",
        source: "publis_conversion_funnel",
        returnTo,
      });
    } else if (currentState === "no-pro") {
      window.dispatchEvent(
        new CustomEvent("open-subscribe-modal", {
          detail: {
            context: "publis",
            source: "publis_conversion_funnel",
            returnTo,
          },
        })
      );
    } else if (currentState === "no-instagram") {
      try {
        await startInstagramReconnect({
          nextTarget: "campaigns",
          source: "publis_conversion_funnel",
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
      title: "Sua Biblioteca de Publis",
      description: "Organize todas as suas parcerias em um só lugar com métricas automáticas e relatórios para marcas.",
      cta: "Criar conta grátis",
      badge: "Passo 1 de 3",
    },
    "no-pro": {
      title: "Desbloqueie Minhas Publis",
      description: "Acompanhe o desempenho real das suas campanhas e compartilhe links de resultados profissionais.",
      cta: "Assinar Plano Pro",
      badge: "Passo 2 de 3",
    },
    "no-instagram": {
      title: "Conecte seu Instagram",
      description: "Precisamos dos seus dados para puxar automaticamente seus posts de publicidade e métricas.",
      cta: "Conectar Instagram",
      badge: "Passo 3 de 3",
    },
  };

  const activeContent = content[currentState];

  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-6">
      {/* Visual Demo Preview (Publis Mockup) */}
      <div className="relative mb-8 w-full max-w-sm">
        <div className="absolute inset-0 -z-10 scale-95 opacity-50 blur-xl">
           <div className="h-full w-full rounded-[2.5rem] bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500" />
        </div>
        
        <div className="overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/40 shadow-2xl backdrop-blur-md p-4">
          <div className="grid grid-cols-2 gap-3">
             {[1, 2, 3, 4].map((i) => (
               <div key={i} className="h-32 rounded-2xl bg-white/60 p-3 shadow-sm">
                 <div className="aspect-square w-full rounded-lg bg-zinc-200/50" />
                 <div className="mt-2 h-2 w-12 rounded-full bg-zinc-100" />
                 <div className="mt-1.5 h-1.5 w-8 rounded-full bg-zinc-50" />
               </div>
             ))}
          </div>
          
          {/* Overlay Lock */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[2px]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-xl ring-1 ring-zinc-100"
            >
              <Layout className="h-6 w-6 text-indigo-500" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Funnel Steps */}
      <div className="mb-8 flex w-full max-w-xs items-center justify-between gap-2">
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
              <div className="mb-4 h-px flex-1 bg-zinc-100" />
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
          className="text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-100">
            <Sparkles className="h-3 w-3" />
            {activeContent.badge}
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            {activeContent.title}
          </h2>
          <p className="mx-auto mt-3 max-w-[280px] text-sm leading-relaxed text-zinc-500">
            {activeContent.description}
          </p>

          <button
            onClick={handleAction}
            className="group relative mt-8 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-zinc-950 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black hover:shadow-xl active:scale-95"
          >
            <span className="relative z-10">{activeContent.cta}</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 -z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </button>
          
          <div className="mt-4 flex items-center justify-center gap-1.5 opacity-50">
            <Lock className="h-3 w-3" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Acesso Seguro</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
