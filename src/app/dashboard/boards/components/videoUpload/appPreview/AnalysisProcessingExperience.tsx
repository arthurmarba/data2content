"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ANALYSIS_PROGRESS_STAGES, useAnalysisProgress } from "./useAnalysisProgress";

export function AnalysisProcessingExperience({
  thumbnailSrc,
  active,
  complete,
  resetKey,
  errorMessage,
}: {
  thumbnailSrc?: string | null;
  active: boolean;
  complete: boolean;
  resetKey?: number | string;
  errorMessage?: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const { progress, stageIndex } = useAnalysisProgress({ active, complete, resetKey });
  const currentStage = ANALYSIS_PROGRESS_STAGES[stageIndex] ?? ANALYSIS_PROGRESS_STAGES[0]!;
  const completedStages = ANALYSIS_PROGRESS_STAGES
    .slice(0, Math.min(stageIndex, ANALYSIS_PROGRESS_STAGES.length - 1))
    .slice(-3);
  const completed = progress >= 100;

  return (
    <div className="pb-1">
      <motion.figure
        layoutId={thumbnailSrc ? "content-analysis-thumbnail" : undefined}
        transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative -mx-5 -mt-1 aspect-[16/10] overflow-hidden bg-zinc-950"
      >
        {thumbnailSrc ? (
          <motion.img
            src={thumbnailSrc}
            alt="Capa do vídeo em análise"
            className="h-full w-full object-cover opacity-70"
            initial={false}
            animate={reduceMotion ? undefined : { scale: [1.015, 1.055, 1.015] }}
            transition={{ duration: 7, ease: "easeInOut", repeat: Infinity }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none" className="text-white/45">
              <path d="M13 8H8v5M29 8h5v5M34 29v5h-5M13 34H8v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M15 21h12M21 15v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}

        <div className="absolute inset-0 bg-black/20" aria-hidden="true" />
        <span className="absolute left-4 top-4 h-5 w-5 border-l border-t border-white/80" aria-hidden="true" />
        <span className="absolute right-4 top-4 h-5 w-5 border-r border-t border-white/80" aria-hidden="true" />
        <span className="absolute bottom-4 left-4 h-5 w-5 border-b border-l border-white/80" aria-hidden="true" />
        <span className="absolute bottom-4 right-4 h-5 w-5 border-b border-r border-white/80" aria-hidden="true" />

        {!errorMessage && !completed ? (
          <motion.span
            className="absolute left-4 right-4 z-10 h-px bg-white/90 shadow-[0_0_16px_3px_rgba(255,255,255,0.35)]"
            initial={false}
            animate={reduceMotion ? { top: "50%" } : { top: ["14%", "84%", "14%"] }}
            transition={{ duration: 3.1, ease: "easeInOut", repeat: Infinity }}
            aria-hidden="true"
          />
        ) : null}

        <figcaption className="absolute bottom-4 left-5 right-5 z-20 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/70">
          <span>{completed ? "Leitura concluída" : errorMessage ? "Leitura interrompida" : "Conteúdo em análise"}</span>
          <span>Vídeo temporário</span>
        </figcaption>
      </motion.figure>

      {errorMessage ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-6"
          role="alert"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">Análise interrompida</p>
          <h3 className="mt-2 font-display text-[1.55rem] font-bold leading-[1.02] tracking-[-0.04em] text-zinc-950">
            Não foi possível concluir agora.
          </h3>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{errorMessage}</p>
        </motion.div>
      ) : (
        <div className="pt-6">
          <div className="flex items-end justify-between gap-4">
            <p className="font-display text-[3.1rem] font-bold leading-none tracking-[-0.065em] text-zinc-950 tabular-nums">
              {progress}<span className="ml-0.5 text-[1.25rem] tracking-[-0.03em] text-zinc-400">%</span>
            </p>
            <p className="pb-1 text-[11px] font-medium text-zinc-400">
              {completed ? "Concluído" : "Pode levar alguns instantes"}
            </p>
          </div>

          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100"
            role="progressbar"
            aria-label="Progresso da análise do vídeo"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <motion.div
              className="h-full rounded-full bg-zinc-950"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
            />
          </div>

          <div className="min-h-[6.7rem] pt-6" aria-live="polite" aria-atomic="true">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStage.threshold}
                initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
                transition={{ duration: reduceMotion ? 0 : 0.22 }}
              >
                <p className="font-display text-[1.25rem] font-bold leading-tight tracking-[-0.035em] text-zinc-950">
                  {currentStage.label}
                </p>
                <p className="mt-1.5 max-w-[34ch] text-sm leading-5 text-zinc-500">{currentStage.detail}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {completedStages.length > 0 ? (
            <div className="mt-1 space-y-2.5 border-t border-zinc-100 pt-4" aria-label="Etapas concluídas">
              {completedStages.map((stage) => (
                <div key={stage.threshold} className="flex items-center gap-2.5 text-xs text-zinc-400">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-zinc-950 text-white" aria-hidden="true">
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.3 4.1 7.4 8.2 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>{stage.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
