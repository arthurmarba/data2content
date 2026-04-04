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
  Calendar,
  MessageSquare,
  Clock
} from "lucide-react";
import { useSession } from "next-auth/react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { startInstagramReconnect } from "@/app/lib/instagram/client/startInstagramReconnect";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

type ConversionState = "logged-out" | "no-pro" | "no-instagram";

type PlanningConversionSectionProps = {
  variant?: "planner" | "discover" | "whatsapp";
  returnTo?: string;
};

export default function PlanningConversionSection({ 
  variant = "planner",
  returnTo = "/dashboard/planning" 
}: PlanningConversionSectionProps) {
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
    if (currentState === "logged-out" || currentState === "no-pro") {
      window.dispatchEvent(
        new CustomEvent("open-subscribe-modal", {
          detail: {
            context: variant === "whatsapp" ? "whatsapp" : "planning",
            source: `planning_conversion_funnel_${variant}`,
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
              context: variant === "whatsapp" ? "whatsapp" : "planning",
              source: `planning_conversion_funnel_${variant}`,
              returnTo,
              proposalId: null,
              ts: Date.now(),
            })
          );
        }
        await startInstagramReconnect({
          nextTarget: "planner",
          source: `planning_conversion_funnel_${variant}`,
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
      title: "Pautas e Narrativa (IA)",
      description: "Planeje sua semana com a inteligência da D2C e nunca mais fique sem saber o que postar.",
      cta: "Criar conta grátis",
      badge: "Passo 1 de 3",
    },
    "no-pro": {
      title: "Desbloqueie seu Planner",
      description: "Gere slots de conteúdo estratégicos baseados nas revisões semanais e no seu nicho.",
      cta: "Assinar Plano Pro",
      badge: "Passo 2 de 3",
    },
    "no-instagram": {
      title: "Conecte seu Instagram",
      description: "Precisamos analisar sua performance para sugerir os melhores horários e temas de conteúdo.",
      cta: "Conectar Instagram",
      badge: "Passo 3 de 3",
    },
  };

  const activeContent = content[currentState];

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 sm:px-6">
      {/* Visual Demo Preview (Planner Mockup) */}
      <div className="relative mb-10 w-full max-w-sm">
        <div className="absolute inset-x-0 -top-10 -z-10 mx-auto h-40 w-40 opacity-30 blur-3xl">
           <div className="h-full w-full rounded-full bg-gradient-to-br from-pink-400 to-brand-primary" />
        </div>
        
        <div className="overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/60 shadow-2xl backdrop-blur-xl p-5">
          {/* Mockup Header */}
          <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3">
             <div className="flex items-center gap-2">
               <div className="h-2 w-2 rounded-full bg-emerald-500" />
               <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Março 2026</span>
             </div>
             <div className="flex gap-1">
               <div className="h-1 w-3 rounded-full bg-zinc-200" />
               <div className="h-1 w-3 rounded-full bg-zinc-200" />
             </div>
          </div>

          <div className="space-y-3">
             {/* Slot 1 */}
             <div className="group relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-100 transition hover:ring-brand-primary/20">
               <div className="flex items-center justify-between gap-3">
                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2">
                     <Clock className="w-3 h-3 text-brand-primary" />
                     <span className="text-[10px] font-bold text-brand-primary uppercase">10:00 • Stories</span>
                   </div>
                   <div className="h-2.5 w-32 rounded-full bg-zinc-100 mt-1" />
                   <div className="h-2 w-20 rounded-full bg-zinc-50" />
                 </div>
                 <div className="rounded-lg bg-pink-50 p-1.5">
                   <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                 </div>
               </div>
             </div>

             {/* Slot 2 */}
             <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-100 opacity-60">
               <div className="flex items-center justify-between gap-3">
                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2">
                     <Clock className="w-3 h-3 text-zinc-300" />
                     <span className="text-[10px] font-bold text-zinc-400 uppercase">18:00 • Reels</span>
                   </div>
                   <div className="h-2.5 w-24 rounded-full bg-zinc-100 mt-1" />
                   <div className="h-2 w-16 rounded-full bg-zinc-50" />
                 </div>
                 <div className="rounded-lg bg-zinc-50 p-1.5">
                   <MessageSquare className="w-3.5 h-3.5 text-zinc-300" />
                 </div>
               </div>
             </div>

             {/* Slot 3 */}
             <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-100 opacity-40">
               <div className="h-2.5 w-36 rounded-full bg-zinc-50" />
             </div>
          </div>
          
          {/* Overlay Lock */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/5 backdrop-blur-[2px]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-2xl ring-1 ring-zinc-100"
            >
              <Calendar className="h-7 w-7 text-brand-primary" />
            </motion.div>
          </div>
        </div>
      </div>

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
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary ring-1 ring-inset ring-brand-primary/10">
            <Sparkles className="h-3.5 w-3.5" />
            {activeContent.badge}
          </div>
          
          <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-4xl">
            {activeContent.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[300px] text-[15px] leading-relaxed text-zinc-500 sm:max-w-[400px]">
            {activeContent.description}
          </p>

          <button
            onClick={handleAction}
            className="group relative mt-10 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-zinc-950 px-10 py-4 text-sm font-bold text-white transition-all hover:bg-black hover:shadow-2xl active:scale-95"
          >
            <span className="relative z-10">{activeContent.cta}</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 -z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </button>
          
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
