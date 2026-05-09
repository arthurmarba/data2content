"use client";

import type {
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveMode,
} from "../postCreationAdaptiveTypes";

export type PostCreationAdaptiveDiagnosisCardProps = {
  detection: PostCreationAdaptiveIntentDetection | null;
  questionCount?: number;
};

const MODE_LABELS: Record<PostCreationAdaptiveMode, string> = {
  validate_pauta: "Validar pauta",
  discover_pauta: "Descobrir pauta",
  create_by_goal: "Criar por objetivo",
  brand_match: "Match com marca",
  collab_match: "Match de collab",
  comment_to_post: "Transformar comentário",
  weekly_plan: "Planejar semana",
  unknown: "Entender intenção",
};

const MODE_DESCRIPTIONS: Record<PostCreationAdaptiveMode, string> = {
  validate_pauta: "Você já trouxe uma ideia e o próximo passo é refinar execução, gancho e CTA.",
  discover_pauta: "Você quer encontrar uma pauta a partir do objetivo, formato e território narrativo.",
  create_by_goal: "Você tem um resultado em mente e precisa transformar esse objetivo em conteúdo.",
  brand_match: "A intenção principal é criar uma narrativa com potencial de encaixe comercial.",
  collab_match: "A estratégia deve definir dinâmica, creator ideal e motivo da colaboração.",
  comment_to_post: "O ponto de partida é um comentário ou dúvida que pode virar conteúdo.",
  weekly_plan: "A prioridade é organizar uma direção editorial para a semana.",
  unknown: "A intenção ainda está aberta, então o quiz começa esclarecendo o melhor caminho.",
};

export function getPostCreationAdaptiveModeLabel(mode: PostCreationAdaptiveMode) {
  return MODE_LABELS[mode];
}

export default function PostCreationAdaptiveDiagnosisCard({
  detection,
  questionCount,
}: PostCreationAdaptiveDiagnosisCardProps) {
  if (!detection) return null;

  const confidence = Math.round(Math.max(0, Math.min(1, detection.confidence || 0)) * 100);
  const signals = detection.signals.filter(Boolean).slice(0, 5);

  return (
    <section className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Diagnóstico</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            {getPostCreationAdaptiveModeLabel(detection.mode)}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{MODE_DESCRIPTIONS[detection.mode]}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            {confidence}% de confiança
          </span>
          {typeof questionCount === "number" ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              {questionCount} perguntas
            </span>
          ) : null}
        </div>
      </div>

      {signals.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sinais detectados</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {signals.map((signal) => (
              <span key={signal} className="rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs text-slate-700">
                {signal}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
