"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ScriptAdjustmentRecommendation,
  ScriptAdjustmentStep,
} from "@/app/dashboard/boards/videoUpload/scriptAdjustmentRecommendation";

export type ScriptAdjustmentInteraction =
  | "script_adjustment_viewed"
  | "script_adjustment_expanded"
  | "script_adjustment_copied"
  | "script_adjustment_step_toggled"
  | "script_adjustment_selected";

const EFFORT_LABEL: Record<ScriptAdjustmentRecommendation["effort"], string> = {
  no_rerecord: "Sem regravar",
  one_pickup: "Uma fala nova",
  new_version: "Nova versão",
};

const ACTION_LABEL: Record<ScriptAdjustmentStep["action"], string> = {
  keep: "Manter",
  cut: "Cortar",
  shorten: "Encurtar",
  move: "Mover",
  overlay: "Texto na tela",
  rerecord: "Gravar",
};

function seconds(milliseconds: number): string {
  const value = milliseconds / 1000;
  return Number.isInteger(value) ? `${value}s` : `${value.toFixed(1).replace(".", ",")}s`;
}

function rangeLabel(start: number | null, end: number | null): string | null {
  if (start === null) return null;
  return end !== null ? `${seconds(start)}–${seconds(end)}` : `A partir de ${seconds(start)}`;
}

function basisLabel(recommendation: ScriptAdjustmentRecommendation): string {
  const { creatorPosts, territoryPosts } = recommendation.basis;
  if (creatorPosts > 0 && territoryPosts > 0) return "Também considera conteúdos seus e sinais do seu território.";
  if (creatorPosts > 0) return "Também considera estruturas que já funcionaram nos seus conteúdos.";
  return "Baseado no que foi observado neste vídeo.";
}

function copyForStep(step: ScriptAdjustmentStep): string {
  return [step.title, step.instruction, step.suggestedCopy ? `Texto sugerido: ${step.suggestedCopy}` : null]
    .filter(Boolean)
    .join("\n");
}

export function ScriptAdjustmentCard({
  recommendation,
  onInteraction,
  onSelectionChange,
}: {
  recommendation: ScriptAdjustmentRecommendation;
  onInteraction?: (event: ScriptAdjustmentInteraction, actionType: string) => void;
  onSelectionChange?: (selectedStepIds: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    onInteraction?.("script_adjustment_viewed", recommendation.effort);
  }, [onInteraction, recommendation.effort]);

  const copyText = async (id: string, value: string, actionType: string) => {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      // WebViews podem bloquear o clipboard; a confirmação visual ainda orienta o usuário.
    }
    setCopiedId(id);
    onInteraction?.("script_adjustment_copied", actionType);
  };

  const toggleStep = (step: ScriptAdjustmentStep) => {
    const next = selectedStepIds.includes(step.id)
      ? selectedStepIds.filter((id) => id !== step.id)
      : [...selectedStepIds, step.id];
    setSelectedStepIds(next);
    onSelectionChange?.(next);
    onInteraction?.("script_adjustment_step_toggled", step.action);
  };

  const selectWholePlan = () => {
    const next = recommendation.steps.map((step) => step.id);
    setSelectedStepIds(next);
    onSelectionChange?.(next);
    onInteraction?.("script_adjustment_selected", recommendation.effort);
  };

  const currentLabels = recommendation.currentStructure.map((block) => block.label);
  const recommendedLabels = recommendation.recommendedStructure.map((block) => block.label);

  return (
    <section className="rounded-[1.6rem] border border-zinc-200 bg-white p-5" aria-labelledby="script-adjustment-title">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">Ajuste de roteiro</p>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600">
          {EFFORT_LABEL[recommendation.effort]}
        </span>
      </div>

      <h2 id="script-adjustment-title" className="mt-3 text-lg font-bold leading-6 tracking-[-0.025em] text-zinc-950">
        {recommendation.summary}
      </h2>
      <p className="mt-2 text-sm leading-5 text-zinc-600">{recommendation.rationale}</p>

      {currentLabels.length > 0 && recommendedLabels.length > 0 ? (
        <dl className="mt-4 space-y-3 rounded-2xl bg-zinc-50 p-4">
          <div>
            <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400">Como está</dt>
            <dd className="mt-1.5 text-xs leading-5 text-zinc-600">{currentLabels.join(" → ")}</dd>
          </div>
          <div>
            <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400">Ordem sugerida</dt>
            <dd className="mt-1.5 text-xs font-semibold leading-5 text-zinc-900">{recommendedLabels.join(" → ")}</dd>
          </div>
        </dl>
      ) : null}

      <p className="mt-3 text-[10px] leading-4 text-zinc-400">{basisLabel(recommendation)}</p>

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((current) => !current);
          if (!expanded) onInteraction?.("script_adjustment_expanded", recommendation.effort);
        }}
        className="mt-4 min-h-11 w-full rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
      >
        {expanded ? "Fechar passo a passo" : "Ver passo a passo"}
      </button>

      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
          {recommendation.steps.map((step, index) => {
            const sourceRange = rangeLabel(step.sourceStartMs, step.sourceEndMs);
            const targetRange = rangeLabel(step.targetStartMs, step.targetEndMs);
            const selected = selectedStepIds.includes(step.id);
            return (
              <article key={step.id} className="rounded-2xl bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                      Passo {index + 1} · {ACTION_LABEL[step.action]}
                    </p>
                    <h3 className="mt-1.5 text-sm font-bold leading-5 text-zinc-950">{step.title}</h3>
                  </div>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={selected ? `Desmarcar passo ${index + 1}` : `Marcar passo ${index + 1} como usado`}
                    onClick={() => toggleStep(step)}
                    className={`min-h-9 shrink-0 rounded-lg px-3 text-[10px] font-bold transition-colors ${
                      selected ? "bg-zinc-950 text-white" : "bg-white text-zinc-600"
                    }`}
                  >
                    {selected ? "Vou usar" : "Marcar"}
                  </button>
                </div>
                {(sourceRange || targetRange) ? (
                  <p className="mt-2 text-[10px] font-semibold text-zinc-500">
                    {sourceRange ? `Trecho atual: ${sourceRange}` : null}
                    {sourceRange && targetRange ? " · " : null}
                    {targetRange ? `Nova posição: ${targetRange}` : null}
                  </p>
                ) : null}
                <p className="mt-2 text-sm leading-5 text-zinc-700">{step.instruction}</p>
                {step.suggestedCopy ? (
                  <div className="mt-3 rounded-xl bg-white p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.11em] text-zinc-400">Texto sugerido</p>
                    <p className="mt-1.5 text-sm font-semibold leading-5 text-zinc-900">“{step.suggestedCopy}”</p>
                  </div>
                ) : null}
                <p className="mt-2 text-xs leading-5 text-zinc-500">{step.reason}</p>
                <button
                  type="button"
                  onClick={() => void copyText(step.id, copyForStep(step), step.action)}
                  className="mt-2 min-h-9 text-xs font-bold text-zinc-700 underline decoration-zinc-300 underline-offset-4"
                >
                  {copiedId === step.id ? "Copiado" : step.suggestedCopy ? "Copiar orientação e texto" : "Copiar orientação"}
                </button>
              </article>
            );
          })}

          <button
            type="button"
            onClick={selectWholePlan}
            className="min-h-11 w-full rounded-xl border border-zinc-300 px-4 text-sm font-bold text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            Usar este plano
          </button>
        </div>
      ) : null}
    </section>
  );
}

