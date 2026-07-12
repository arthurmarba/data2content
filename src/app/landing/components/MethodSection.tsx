"use client";

import React from "react";
import { motion } from "framer-motion";

type MethodStep = {
  id: string;
  step: string;
  title: string;
  description: string;
  highlight: string;
};

const METHOD_STEPS: MethodStep[] = [
  {
    id: "connect",
    step: "01",
    title: "Entre e conecte seu Instagram",
    description:
      "Login com Google, conexão segura pela API oficial da Meta e diagnóstico do seu conteúdo por IA em minutos.",
    highlight: "Diagnóstico por IA",
  },
  {
    id: "direction",
    step: "02",
    title: "Receba direção toda semana",
    description:
      "Mentorias ao vivo de roteiro (terças) e de conteúdo (quintas), com revisões contínuas de posicionamento e narrativa.",
    highlight: "Mentorias ao vivo",
  },
  {
    id: "opportunities",
    step: "03",
    title: "Seja encontrado pelas marcas",
    description:
      "Seu mídia kit é auditado em tempo real e você entra no banco de talentos avaliado para representação comercial pela Agência Destaque.",
    highlight: "Representação comercial",
  },
];

export default function MethodSection() {
  return (
    <section
      id="como-funciona"
      className="landing-section relative overflow-hidden border-y border-slate-100 bg-[#FBFBFC] py-10 scroll-mt-[calc(var(--landing-header-h,4.5rem)+10px)] sm:py-16 lg:py-20"
    >
      <div className="pointer-events-none absolute -top-24 right-[8%] h-72 w-72 rounded-full bg-brand-accent/5 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-24 left-[6%] h-72 w-72 rounded-full bg-brand-primary/5 blur-[110px]" />

      <div className="landing-section__inner landing-section__inner--wide relative z-10">
        <header className="mx-auto mb-8 max-w-[22rem] text-center sm:mb-12 sm:max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.26em] text-slate-400 shadow-sm sm:px-4 sm:py-2 sm:text-[10px] sm:tracking-[0.3em]">
            Como funciona
          </span>
          <h2 className="mt-4 text-[1.85rem] font-black leading-[1.05] tracking-tight text-brand-dark sm:mt-6 sm:text-4xl md:text-5xl">
            Da criação à{" "}
            <span className="bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
              oportunidade certa
            </span>{" "}
            em três passos.
          </h2>
          <p className="mt-3 text-[14px] font-medium leading-[1.6] text-slate-500 sm:mt-4 sm:text-base">
            Um método contínuo: você cria, a gente direciona e as marcas encontram você.
          </p>
        </header>

        <ol className="relative mx-auto grid max-w-5xl gap-4 md:grid-cols-3 md:gap-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-[2.4rem] hidden h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent md:block"
          />
          {METHOD_STEPS.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, delay: index * 0.12, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="relative flex flex-col gap-3 rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_32px_rgba(20,33,61,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-primary/20 hover:shadow-[0_20px_40px_rgba(20,33,61,0.08)] sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[1.05rem] bg-brand-dark text-[0.95rem] font-black tracking-tight text-white shadow-lg shadow-brand-dark/15">
                  {item.step}
                </span>
                <span className="rounded-full border border-brand-primary/15 bg-brand-primary/[0.06] px-2.5 py-1 text-[8.5px] font-black uppercase tracking-[0.14em] text-brand-primary sm:text-[9px]">
                  {item.highlight}
                </span>
              </div>
              <h3 className="text-[1.08rem] font-black leading-[1.15] tracking-[-0.02em] text-brand-dark sm:text-[1.15rem]">
                {item.title}
              </h3>
              <p className="text-[13px] font-medium leading-[1.65] text-slate-600 sm:text-sm">
                {item.description}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
