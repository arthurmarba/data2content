"use client";

import React from "react";
import { motion } from "framer-motion";

import { LANDING_PRICE_SUPPORT, getLandingPrimaryCtaLabel } from "@/app/landing/copy";

type ClosingCtaSectionProps = {
  onPrimaryCta: () => void;
  isAuthenticated?: boolean;
};

const REASSURANCES = ["Login com Google", "Sem fidelidade", "API oficial do Instagram"];

export default function ClosingCtaSection({
  onPrimaryCta,
  isAuthenticated = false,
}: ClosingCtaSectionProps) {
  const primaryLabel = getLandingPrimaryCtaLabel(isAuthenticated);

  return (
    <section
      id="cta-final"
      className="relative overflow-hidden bg-[#10182B] py-14 sm:py-20"
    >
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-brand-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 right-[10%] h-64 w-64 rounded-full bg-brand-accent/15 blur-[100px]" />

      <div className="landing-section__inner relative z-10 mx-auto max-w-3xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-[2rem] font-black leading-[1.05] tracking-tight text-white sm:text-4xl md:text-5xl"
        >
          Você cria.{" "}
          <span className="bg-gradient-to-r from-brand-primary via-[#FF4080] to-brand-accent bg-clip-text text-transparent">
            A direção é com a gente.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mx-auto mt-4 max-w-[38ch] text-[14.5px] font-medium leading-[1.65] text-slate-300 sm:text-base"
        >
          Entre hoje, conecte seu Instagram e chegue na próxima mentoria com o seu
          conteúdo já diagnosticado.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mt-8 flex flex-col items-center gap-4"
        >
          <div className="group relative">
            <div className="absolute -inset-1 rounded-[1.35rem] bg-gradient-to-r from-brand-primary/40 via-brand-accent/40 to-brand-primary/40 opacity-70 blur-md transition duration-700 group-hover:opacity-100" />
            <button
              type="button"
              onClick={onPrimaryCta}
              className="relative inline-flex min-w-[15rem] items-center justify-center gap-2 rounded-[1.25rem] bg-brand-primary px-8 py-4 text-[1rem] font-black text-white shadow-[0_16px_30px_rgba(245,43,106,0.3)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:min-w-[18rem] sm:py-5 sm:text-lg"
            >
              {primaryLabel}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </button>
          </div>

          {!isAuthenticated ? (
            <p className="text-[11.5px] font-semibold text-slate-400 sm:text-xs">
              {LANDING_PRICE_SUPPORT}
            </p>
          ) : null}

          <ul className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {REASSURANCES.map((item) => (
              <li
                key={item}
                className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]"
              >
                <span aria-hidden="true" className="text-brand-primary">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
