"use client";

import { useState } from "react";
import type {
  HookRecommendation,
  HookRecommendationCandidate,
} from "@/app/dashboard/boards/videoUpload/hookRecommendation";

export type HookRecommendationInteraction =
  | "hook_copied"
  | "hook_selected"
  | "hook_alternatives_viewed";

const STRATEGY_LABEL: Record<HookRecommendationCandidate["strategy"], string> = {
  creator_first: "Mais a sua cara",
  territory_first: "Sinal do território",
  hybrid: "Equilíbrio recomendado",
};

function basisLabel(recommendation: HookRecommendation): string {
  const { creatorPosts, territoryPosts, confidence } = recommendation.basis;
  if (creatorPosts > 0 && territoryPosts > 0) {
    return `Baseado em ${creatorPosts} conteúdos seus e sinais agregados do território · confiança ${confidence === "high" ? "alta" : confidence === "medium" ? "média" : "inicial"}`;
  }
  if (creatorPosts > 0) {
    return `Baseado em ${creatorPosts} ${creatorPosts === 1 ? "conteúdo seu" : "conteúdos seus"} · confiança ${confidence === "high" ? "alta" : confidence === "medium" ? "média" : "inicial"}`;
  }
  return "Baseado na estrutura observada neste vídeo.";
}

export function HookRecommendationCard({
  recommendation,
  onInteraction,
  onCandidateChosen,
}: {
  recommendation: HookRecommendation;
  onInteraction?: (event: HookRecommendationInteraction, actionType: string) => void;
  onCandidateChosen?: (candidateId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(recommendation.primary.id);
  const [alternativesOpen, setAlternativesOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const candidates = [recommendation.primary, ...recommendation.alternatives];
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? recommendation.primary;

  const copyCandidate = async (candidate: HookRecommendationCandidate) => {
    const copy = [
      candidate.spokenLine,
      candidate.onScreenText ? `Texto na tela: ${candidate.onScreenText}` : null,
      candidate.firstFrameDirection ? `Primeiro frame: ${candidate.firstFrameDirection}` : null,
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard?.writeText(copy);
    } catch {
      // A seleção ainda fica visível quando o WebView bloqueia o clipboard.
    }
    setCopiedId(candidate.id);
    onInteraction?.("hook_copied", candidate.strategy);
    onCandidateChosen?.(candidate.id);
  };

  const selectCandidate = (candidate: HookRecommendationCandidate) => {
    setSelectedId(candidate.id);
    setAlternativesOpen(false);
    onInteraction?.("hook_selected", candidate.strategy);
    onCandidateChosen?.(candidate.id);
  };

  return (
    <section className="rounded-[1.6rem] bg-zinc-950 p-5 text-white" aria-labelledby="recommended-hook-title">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Gancho para este vídeo</p>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70">
          {STRATEGY_LABEL[selected.strategy]}
        </span>
      </div>

      <blockquote id="recommended-hook-title" className="mt-4 font-display text-[1.65rem] font-bold leading-[1.08] tracking-[-0.045em] text-white">
        “{selected.spokenLine}”
      </blockquote>

      {selected.onScreenText ? (
        <div className="mt-4 rounded-xl bg-white/10 px-3.5 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/45">Texto na tela</p>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-white/90">{selected.onScreenText}</p>
        </div>
      ) : null}

      {selected.firstFrameDirection ? (
        <div className="mt-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/45">Primeiro frame</p>
          <p className="mt-1.5 text-sm leading-5 text-white/75">{selected.firstFrameDirection}</p>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-5 text-white/70">{selected.whyForThisVideo}</p>
      <p className="mt-3 text-[10px] leading-4 text-white/40">{basisLabel(recommendation)}</p>

      <button
        type="button"
        onClick={() => copyCandidate(selected)}
        className="mt-5 min-h-11 w-full rounded-xl bg-white px-4 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-100"
      >
        {copiedId === selected.id ? "Gancho copiado" : "Copiar gancho"}
      </button>

      {recommendation.alternatives.length > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={alternativesOpen}
            onClick={() => {
              setAlternativesOpen((open) => !open);
              if (!alternativesOpen) onInteraction?.("hook_alternatives_viewed", selected.strategy);
            }}
            className="min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            {alternativesOpen ? "Fechar outras versões" : "Ver outras versões"}
          </button>

          {alternativesOpen ? (
            <div className="mt-2 space-y-2 border-t border-white/10 pt-3">
              {recommendation.alternatives.map((candidate) => (
                <article key={candidate.id} className="rounded-xl bg-white/[0.06] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/40">
                    {STRATEGY_LABEL[candidate.strategy]}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-white/90">“{candidate.spokenLine}”</p>
                  <p className="mt-2 text-xs leading-5 text-white/55">{candidate.whyForThisVideo}</p>
                  <button
                    type="button"
                    onClick={() => selectCandidate(candidate)}
                    className="mt-3 min-h-10 rounded-lg bg-white/10 px-3.5 text-xs font-bold text-white transition-colors hover:bg-white/15"
                  >
                    Usar este
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
