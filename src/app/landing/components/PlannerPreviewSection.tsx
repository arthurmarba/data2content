"use client";

import React, { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";

const PlannerPreviewSection: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        if (!e?.data || typeof e.data !== "object") return;
        // Segurança básica: apenas mesma origem
        if (e.origin && e.origin !== window.location.origin) return;
        if (e.data.type !== "planner-demo:height") return;
        const nextH = Number(e.data.height);
        if (!Number.isFinite(nextH)) return;
        const iframe = iframeRef.current;
        if (iframe) {
          // Ajuste com limites para evitar alturas absurdas
          const clamped = Math.max(600, Math.min(nextH + 16 /* small padding */, 2000));
          iframe.style.height = `${clamped}px`;
        }
        // Se chegou mensagem, consideramos carregado também
        setLoaded(true);
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <section id="planner-preview" className="border-t border-[#E6EAFB] bg-[#FDFDFD] py-16 text-brand-dark md:py-20">
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
          <div className="w-full lg:w-5/12">
            <div className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-text-secondary md:text-sm">
              Planner em ação
            </div>
            <h2 className="mt-3 text-[2rem] font-semibold leading-tight md:text-[2.5rem]">
              Planejamento inteligente com IA, do tema à execução
            </h2>
            <p className="mt-4 text-base leading-relaxed text-brand-text-secondary md:text-lg">
              Veja como a IA transforma suas categorias em temas, pautas e roteiros, posicionando cada conteúdo no melhor dia e horário.
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-normal text-brand-text-secondary md:text-base">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-purple" />
                <div>
                  <b className="font-semibold text-brand-dark">Tema e pautas:</b> cruzamos Proposta, Contexto, Tom e Referência para sugerir assuntos que combinam com seu estilo.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-magenta" />
                <div>
                  <b className="font-semibold text-brand-dark">Roteiro curto:</b> gancho, estrutura e CTA prontos para gravar, com variações de estratégia.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-teal" />
                <div>
                  <b className="font-semibold text-brand-dark">Melhor horário:</b> usamos seu histórico para recomendar janelas de alta performance.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-orange" />
                <div>
                  <b className="font-semibold text-brand-dark">Inspiração da comunidade:</b> referências recentes semelhantes ao seu tema para você se inspirar.
                </div>
              </li>
            </ul>
          </div>

          <div className="w-full lg:w-7/12">
            <div className="relative rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
              <div className="h-8 bg-gray-100 flex items-center px-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 block rounded-full bg-red-500"></span>
                  <span className="h-3 w-3 block rounded-full bg-yellow-500"></span>
                  <span className="h-3 w-3 block rounded-full bg-green-500"></span>
                </div>
              </div>
              {/* Skeleton simples enquanto o iframe carrega */}
              {!loaded && (
                <div className="absolute inset-x-0 bottom-0 top-8 bg-white">
                  <div className="h-full w-full animate-pulse bg-gradient-to-b from-gray-50 to-gray-100" />
                </div>
              )}

              <iframe
                ref={iframeRef}
                src="/planner/demo"
                className="w-full block transition-[height] duration-300 ease-out"
                // Altura inicial razoável até recebermos postMessage
                style={{ height: 720 }}
                loading="lazy"
                title="Demonstração do Planejamento"
                aria-label="Demonstração do Planejamento"
                onLoad={() => {
                  setLoaded(true);
                  try { track?.("planner_demo_iframe_load"); } catch {}
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlannerPreviewSection;
