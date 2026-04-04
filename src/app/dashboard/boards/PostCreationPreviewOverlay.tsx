"use client";

import React from "react";
import { ArrowRight, CheckCircle2, Instagram, Rocket, Sparkles, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

type Step = {
  id: string;
  label: string;
  active: boolean;
  completed: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

export default function PostCreationPreviewOverlay({
  onActivate,
}: {
  onActivate: () => void;
}) {
  const steps: Step[] = [
    {
      id: "logged-out",
      label: "Criar Conta",
      icon: UserPlus,
      active: true,
      completed: false,
    },
    {
      id: "pro",
      label: "Plano Pro",
      icon: Rocket,
      active: false,
      completed: false,
    },
    {
      id: "instagram",
      label: "Instagram",
      icon: Instagram,
      active: false,
      completed: false,
    },
  ];

  return (
    <div className="absolute inset-0 z-40 overflow-hidden rounded-[2rem] bg-white/28 backdrop-blur-[12px]">
      <div className="pointer-events-none absolute inset-0 bg-white/58" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.32),rgba(255,255,255,0.06)_58%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-5 top-5 opacity-18 blur-[10px]">
          <div className="mx-auto max-w-[640px]">
            <div className="flex items-center gap-2 rounded-[1rem] bg-white/70 p-1.5">
              <div className="h-8 flex-1 rounded-full bg-zinc-900/75" />
              <div className="h-8 flex-1 rounded-full bg-zinc-100/90" />
            </div>
          </div>
        </div>
        <div className="absolute inset-x-5 top-[7.25rem] opacity-18 blur-[12px]">
          <div className="space-y-8">
            <div className="h-14 rounded-[1.4rem] bg-white/78" />
            <div className="h-14 rounded-[1.4rem] bg-white/72" />
            <div className="h-14 rounded-[1.4rem] bg-white/68" />
          </div>
        </div>
        <div className="absolute inset-x-7 bottom-10 opacity-16 blur-[12px]">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-[1.4rem] bg-white/74" />
            <div className="h-24 rounded-[1.4rem] bg-white/74" />
          </div>
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.58))]" />
      </div>

      <div className="sticky top-10 mx-auto flex w-full max-w-xl flex-col items-center px-6 pt-10 text-center md:top-14 md:pt-14">
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
                  {step.completed ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${step.active ? "text-zinc-900" : "text-zinc-400"}`}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 ? <div className="mb-4 h-px flex-1 bg-zinc-200/50" /> : null}
            </React.Fragment>
          ))}
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-3xl border border-white bg-white/[0.98] p-8 shadow-[0_28px_60px_rgba(24,24,27,0.10)]"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary ring-1 ring-inset ring-brand-primary/10">
            <Sparkles className="h-3.5 w-3.5" />
            Passo 1 de 3
          </div>

          <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
            Criação de Post
          </h2>
          <p className="mx-auto mt-4 max-w-[300px] text-[15px] leading-relaxed text-zinc-500">
            Organize suas ideias em pautas prontas, transforme tudo em roteiro e ative a IA para criar posts com muito mais consistência.
          </p>

          <button
            onClick={onActivate}
            className="group relative mt-8 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-zinc-950 px-10 py-4 text-sm font-bold text-white transition-all hover:bg-black hover:shadow-2xl active:scale-95"
          >
            <span className="relative z-10">Entrar com Google</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 -z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </button>

        </motion.div>
      </div>
    </div>
  );
}
