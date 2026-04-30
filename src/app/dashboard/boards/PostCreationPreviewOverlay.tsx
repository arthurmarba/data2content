"use client";

import React from "react";
import {
  ArrowRight,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

export default function PostCreationPreviewOverlay({
  onActivate,
  activationPending = false,
  activationError = null,
}: {
  onActivate: (acceptedLegal: boolean) => void;
  activationPending?: boolean;
  activationError?: string | null;
}) {
  const [acceptedLegal, setAcceptedLegal] = React.useState(false);
  const trustItems = [
    {
      label: "Leitura somente",
      icon: LockKeyhole,
    },
    {
      label: "Não publicamos nada",
      icon: ShieldCheck,
    },
    {
      label: "Você volta para este board",
      icon: RotateCcw,
    },
  ];

  return (
    <div className="absolute inset-0 z-40 overflow-hidden rounded-[2rem] bg-black/28 backdrop-blur-[8px]">
      <div className="pointer-events-none absolute inset-0 bg-black/34" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),rgba(0,0,0,0.08)_56%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-5 top-[7.25rem] opacity-22 blur-[12px]">
          <div className="space-y-8">
            <div className="h-14 rounded-[1.4rem] bg-white/10" />
            <div className="h-14 rounded-[1.4rem] bg-white/9" />
            <div className="h-14 rounded-[1.4rem] bg-white/8" />
          </div>
        </div>
        <div className="absolute inset-x-7 bottom-10 opacity-18 blur-[12px]">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-[1.4rem] bg-white/10" />
            <div className="h-24 rounded-[1.4rem] bg-white/10" />
          </div>
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,6,0.08),rgba(5,5,6,0.26))]" />
      </div>

      <div className="sticky top-8 mx-auto flex w-full max-w-xl flex-col items-center px-6 pt-8 text-center md:top-14 md:pt-14">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full rounded-[28px] border border-white bg-white/[0.98] p-6 shadow-[0_28px_60px_rgba(24,24,27,0.10)] sm:p-8"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary ring-1 ring-inset ring-brand-primary/10">
            <Sparkles className="h-3.5 w-3.5" />1 análise + 1 pauta grátis
          </div>

          <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
            Conecte para gerar sua primeira pauta
          </h2>
          <p className="mx-auto mt-4 max-w-[340px] text-[15px] leading-relaxed text-zinc-500">
            Usamos seus posts recentes para identificar padrões e montar uma
            pauta validada dentro deste board.
          </p>

          <div className="mx-auto mt-5 grid max-w-[380px] gap-2 text-left sm:grid-cols-3">
            {trustItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-[11px] font-semibold text-zinc-700"
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {activationError ? (
            <p className="mx-auto mt-4 max-w-[340px] rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] font-medium leading-relaxed text-red-700">
              {activationError}
            </p>
          ) : null}

          <div className="mx-auto mt-6 max-w-[340px] text-[12px] leading-relaxed text-zinc-500">
            <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-[11px] font-medium leading-relaxed text-zinc-600">
              <input
                type="checkbox"
                checked={acceptedLegal}
                onChange={(event) => setAcceptedLegal(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
              />
              <span>
                Li e aceito os Termos, a Política de Privacidade e a abertura
                da autorização Meta/Facebook para análise do meu Instagram.
              </span>
            </label>
            <p className="mx-auto max-w-[300px]">
              Vamos usar acesso somente leitura conforme os{" "}
              <a
                href="/termos-e-condicoes"
                target="_blank"
                className="font-semibold text-zinc-600 underline underline-offset-2"
              >
                Termos
              </a>{" "}
              e a{" "}
              <a
                href="/politica-de-privacidade"
                target="_blank"
                className="font-semibold text-zinc-600 underline underline-offset-2"
              >
                Política de Privacidade
              </a>
              . Para salvar ou gerar de novo, vamos pedir conta e assinatura.
            </p>
          </div>

          <button
            onClick={() => onActivate(acceptedLegal)}
            disabled={activationPending || !acceptedLegal}
            className="group relative mt-6 inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-zinc-950 px-10 py-4 text-sm font-bold text-[rgb(255,255,255)] transition-all hover:bg-black hover:shadow-2xl active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:opacity-45"
          >
            <span className="relative z-10">
              {activationPending ? "Abrindo Meta..." : "Autorizar Instagram"}
            </span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 -z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
