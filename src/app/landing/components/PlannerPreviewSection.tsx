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
    <section id="planner-preview" className="py-20 bg-white text-black">
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
          <div className="w-full lg:w-5/12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planejamento Inteligente em Ação</h2>
            <p className="text-lg text-gray-700 mb-6">
              Veja como a IA transforma suas categorias em temas, pautas e roteiros, posicionando cada conteúdo no melhor dia e horário.
            </p>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-purple" />
                <div>
                  <b>Tema e pautas:</b> cruzamos Proposta, Contexto, Tom e Referência para sugerir assuntos que combinam com seu estilo.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-magenta" />
                <div>
                  <b>Roteiro curto:</b> gancho, estrutura e CTA prontos para gravar, com variações de estratégia.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-teal" />
                <div>
                  <b>Melhor horário:</b> usamos seu histórico para recomendar janelas de alta performance.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-orange" />
                <div>
                  <b>Inspiração da comunidade:</b> referências recentes semelhantes ao seu tema para você se inspirar.
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
