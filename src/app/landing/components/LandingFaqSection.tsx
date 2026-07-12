"use client";

import React from "react";
import { motion } from "framer-motion";

import { LANDING_FAQ_ITEMS } from "@/app/landing/faqData";

export default function LandingFaqSection() {
  return (
    <section
      id="faq"
      className="landing-section relative overflow-hidden bg-white py-10 scroll-mt-[calc(var(--landing-header-h,4.5rem)+10px)] sm:py-16 lg:py-20"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="landing-section__inner relative z-10 mx-auto max-w-3xl">
        <header className="mb-7 text-center sm:mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.26em] text-slate-400 shadow-sm sm:px-4 sm:py-2 sm:text-[10px] sm:tracking-[0.3em]">
            Dúvidas frequentes
          </span>
          <h2 className="mt-4 text-[1.85rem] font-black leading-[1.05] tracking-tight text-brand-dark sm:mt-6 sm:text-4xl">
            Tudo o que você precisa saber{" "}
            <span className="bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
              antes de entrar.
            </span>
          </h2>
        </header>

        <div className="space-y-3">
          {LANDING_FAQ_ITEMS.map((item, index) => (
            <motion.div
              key={item.question}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: index * 0.05, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              <details className="group rounded-[1.35rem] border border-slate-200/80 bg-[#FBFBFC] transition-colors duration-300 open:border-brand-primary/20 open:bg-white open:shadow-[0_14px_32px_rgba(20,33,61,0.06)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left text-[14.5px] font-black leading-[1.3] tracking-[-0.01em] text-brand-dark [&::-webkit-details-marker]:hidden sm:px-6 sm:py-5 sm:text-base">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[13px] font-black text-slate-400 transition-all duration-300 group-open:rotate-45 group-open:border-brand-primary/30 group-open:text-brand-primary"
                  >
                    +
                  </span>
                </summary>
                <div className="px-4 pb-5 text-[13.5px] font-medium leading-[1.7] text-slate-600 sm:px-6 sm:text-[15px]">
                  {item.answer}
                </div>
              </details>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
