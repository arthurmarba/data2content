"use client";

import Marquee from "@/app/landing/components/Marquee";
import heroQuestions from "@/data/heroQuestions";
import heroAnswers from "@/data/heroAnswers";

// Complementa com perguntas/pedidos específicos citados pelo usuário
const extraQuestions = [
  "Quais Propostas performam melhor por hora do dia?",
  "Crie um calendário com Formato, Contexto, Tom e Referência por dia.",
  "Qual janela otimiza retenção de Reels no meu nicho?",
  "Quais combinações Proposta+Tom+Formato geram mais salvamentos?",
];

const questionsForLogin = Array.from(new Set([...extraQuestions, ...heroQuestions]));

export default function QADynamicRows() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 select-none">
      <div className="space-y-3">
        {/* Linha de Perguntas/Pedidos (cinza) */}
        <Marquee
          items={questionsForLogin}
          direction="left"
          itemClassName="flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-800 border border-gray-200 shadow-sm"
        />

        {/* Linha de Respostas/Insights (branco) */}
        <Marquee
          items={heroAnswers}
          direction="right"
          itemClassName="flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-2xl bg-white text-gray-900 border border-gray-200 shadow-sm"
        />
      </div>
    </div>
  );
}
