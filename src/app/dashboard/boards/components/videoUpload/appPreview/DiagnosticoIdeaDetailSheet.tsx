"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import {
  resolveContentIdeaCollabBlueprint,
  resolveContentIdeaScriptBlueprint,
  type CollabSceneOwner,
  type ContentIdeaSceneBeat,
} from "@/app/dashboard/boards/videoUpload/contentIdeaBlueprint";
import {
  contentIdeaMapAnchorLabel,
  resolveContentIdeaMapAnchors,
  selectContentIdeaCardAnchors,
} from "@/app/dashboard/boards/videoUpload/contentIdeaMapAnchors";
import { DiagnosticoCloseButton } from "./DiagnosticoCloseButton";
import { CollabModeBadge } from "./CollabModeBadge";
import { StableCreatorAvatar } from "./StableCreatorAvatar";
import {
  buildOpportunityEvidenceSummary,
  simplifyUserFacingText,
} from "@/app/dashboard/boards/videoUpload/contentIdeaOpportunity";

interface Props {
  idea: ContentIdeaListItem;
  collab?: NarrativeCollabMatch | null;
  isPro?: boolean;
  decisionPending?: boolean;
  onDecide?: (decision: "interested" | "dismissed") => void;
  /** Salva a ideia para gravar; funciona tanto no plano solo quanto como alternativa à parceria. */
  onSaveIdea?: () => void;
  awaitingOtherSide?: boolean;
  onOpenCreatorMediaKit?: (slug: string) => void;
  onUpgrade?: () => void;
  onClose: () => void;
}

const BEAT_LABEL: Record<ContentIdeaSceneBeat, string> = {
  abertura: "Abertura",
  contexto: "Desenvolvimento",
  virada: "Virada",
  fechamento: "Fechamento",
};

function ownerLabel(owner: CollabSceneOwner, partnerName: string): string {
  if (owner === "viewer") return "Você";
  if (owner === "partner") return partnerName.split(" ")[0] || "Outra pessoa";
  return "Os dois";
}

function copyTextForIdea(idea: ContentIdeaListItem): string {
  const blueprint = resolveContentIdeaScriptBlueprint(idea.scriptBlueprint, idea);
  return [
    idea.title,
    idea.angle,
    `ABERTURA\n${idea.hook}`,
    ...blueprint.scenes.map((scene, index) =>
      `${String(index + 1).padStart(2, "0")} · ${BEAT_LABEL[scene.beat]}\nVISUAL: ${scene.visual}\nO QUE DIZER: ${scene.spokenIntent}`,
    ),
    blueprint.recordingChecklist.length > 0
      ? `ANTES DE GRAVAR\n${blueprint.recordingChecklist.map((item) => `• ${item}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");
}

export function DiagnosticoIdeaDetailSheet({
  idea,
  collab,
  isPro = false,
  decisionPending = false,
  onDecide,
  onSaveIdea,
  awaitingOtherSide = false,
  onOpenCreatorMediaKit,
  onUpgrade,
  onClose,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [activePlan, setActivePlan] = useState<"solo" | "collab">(collab ? "collab" : "solo");
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const planContentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const blueprint = useMemo(
    () => resolveContentIdeaScriptBlueprint(idea.scriptBlueprint, idea),
    [idea],
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    titleRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const handlePlanChange = useCallback((plan: "solo" | "collab") => {
    if (plan === activePlan) return;
    setActivePlan(plan);

    window.requestAnimationFrame(() => {
      const viewport = scrollViewportRef.current;
      const planContent = planContentRef.current;
      if (!viewport || !planContent) return;
      viewport.scrollTo({
        top: Math.max(0, planContent.offsetTop - 72),
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  }, [activePlan, reduceMotion]);
  return (
    <div
      className="d2c-mobile-app ds-notebook fixed inset-0 z-[270] flex items-end justify-center ds-scrim sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-detail-title"
        initial={reduceMotion ? false : { opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 20 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-[100dvh] w-full max-w-[32rem] flex-col overflow-hidden border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] text-[var(--ds-color-text)] shadow-[var(--ds-shadow-overlay)] sm:h-auto sm:max-h-[min(94dvh,860px)] sm:rounded-[var(--ds-radius-xl)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          ref={scrollViewportRef}
          data-testid="idea-detail-scroll"
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]"
          onScroll={(event) => setHasScrolled(event.currentTarget.scrollTop > 20)}
        >
          <div
            data-testid="idea-detail-toolbar"
            data-scrolled={hasScrolled ? "true" : "false"}
            className={`sticky top-0 z-30 border-b px-5 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] transition-[background-color,border-color,box-shadow] duration-200 sm:px-7 sm:pt-2 ${
              hasScrolled
                ? "border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]/95 backdrop-blur-xl"
                : "border-transparent bg-[var(--ds-color-surface)]"
            }`}
          >
            <div className="flex min-h-11 items-center justify-between gap-3">
              {hasScrolled && collab ? (
                <div className="inline-flex rounded-full bg-zinc-100 p-0.5" aria-label="Escolha do plano fixa">
                  <PlanToggle compact active={activePlan === "solo"} onClick={() => handlePlanChange("solo")}>Só você</PlanToggle>
                  <PlanToggle compact active={activePlan === "collab"} onClick={() => handlePlanChange("collab")}>Em parceria</PlanToggle>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-zinc-500">
                  <span className="font-semibold text-[var(--ds-color-ink)]">{idea.suggestedFormat}</span>
                  <span aria-hidden="true" className="text-zinc-300">/</span>
                  <span className="truncate">{idea.territory}</span>
                  {blueprint.estimatedDurationSeconds ? (
                    <>
                      <span aria-hidden="true" className="text-zinc-300">/</span>
                      <span>{blueprint.estimatedDurationSeconds}s</span>
                    </>
                  ) : null}
                </div>
              )}
              <DiagnosticoCloseButton onClose={onClose} edgeAlign />
            </div>
          </div>

          <div className="px-5 pb-5 pt-3 sm:px-7 sm:pt-4">
            <h2
              ref={titleRef}
              id="idea-detail-title"
              tabIndex={-1}
              style={{ outline: "none" }}
              className="max-w-[22ch] font-display text-[clamp(1.8rem,7.2vw,2.35rem)] font-bold leading-[1.02] tracking-[-0.045em] text-zinc-950 outline-none"
            >
              {idea.title}
            </h2>
            {idea.angle ? (
              <p className="mt-3 max-w-[38ch] text-[16px] leading-[1.45] text-zinc-600">
                {idea.angle}
              </p>
            ) : null}

            {collab ? (
              <div className="mt-5">
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.09em] text-zinc-500">Como você quer gravar?</p>
                <div className="inline-flex rounded-full bg-zinc-100 p-1" aria-label="Como você quer gravar?">
                  <PlanToggle active={activePlan === "solo"} onClick={() => handlePlanChange("solo")}>Só você</PlanToggle>
                  <PlanToggle active={activePlan === "collab"} onClick={() => handlePlanChange("collab")}>Em parceria</PlanToggle>
                </div>
              </div>
            ) : null}
          </div>

          <div ref={planContentRef} className="border-t border-zinc-100 px-5 pb-10 pt-6 sm:px-7">
            <AnimatePresence mode="wait" initial={false}>
              {activePlan === "collab" && collab ? (
                <motion.div
                  key="collab"
                  initial={reduceMotion ? false : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: -10 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <CollabPlan
                    idea={idea}
                    collab={collab}
                    onOpenCreatorMediaKit={onOpenCreatorMediaKit}
                    reduceMotion={Boolean(reduceMotion)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="solo"
                  initial={reduceMotion ? false : { opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: 10 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <SoloPlan idea={idea} reduceMotion={Boolean(reduceMotion)} />
                </motion.div>
              )}
            </AnimatePresence>

            {!collab && !isPro && idea.opportunityBrief?.kind === "collab_optional" ? (
              <CollabContextTeaser onUpgrade={onUpgrade} />
            ) : null}
          </div>
        </div>

        {activePlan === "collab" && decisionPending && onDecide && collab ? (
          <div className="shrink-0 border-t border-zinc-100 bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-7">
            <button
              type="button"
              onClick={() => onDecide("interested")}
              className="ds-button ds-button--secondary min-h-12 w-full"
            >
              Quero gravar com {collab.name.split(" ")[0]}
            </button>
            {onSaveIdea ? (
              <button
                type="button"
                onClick={onSaveIdea}
                className="mt-2 min-h-11 w-full text-[13px] font-semibold text-zinc-600"
              >
                Salvar somente a ideia
              </button>
            ) : null}
          </div>
        ) : activePlan === "collab" && awaitingOtherSide && collab ? (
          <div className="shrink-0 border-t border-[var(--ds-color-line)] bg-[var(--ds-color-warning-soft)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center sm:px-7">
            <p className="text-[14px] font-semibold text-[var(--ds-color-warning)]">
              Você escolheu gravar com {collab.name.split(" ")[0]}.
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.4] text-[var(--ds-color-text-secondary)]">
              Se essa pessoa também escolher, avisamos aqui e no WhatsApp conectado.
            </p>
          </div>
        ) : activePlan === "solo" && onSaveIdea && idea.status !== "saved" ? (
          <div className="shrink-0 border-t border-zinc-100 bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-7">
            <button type="button" onClick={onSaveIdea} className="ds-button ds-button--secondary min-h-12 w-full">
              Salvar ideia para gravar
            </button>
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}

function PlanToggle({ active, compact = false, onClick, children }: { active: boolean; compact?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg font-semibold transition-colors ${compact ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]"} ${active ? "bg-[var(--ds-color-surface)] text-[var(--ds-color-ink)]" : "text-[var(--ds-color-text-secondary)]"}`}
    >
      {children}
    </button>
  );
}

function SoloPlan({ idea, reduceMotion }: { idea: ContentIdeaListItem; reduceMotion: boolean }) {
  const blueprint = resolveContentIdeaScriptBlueprint(idea.scriptBlueprint, idea);
  const openingScene = blueprint.scenes.find((scene) => scene.beat === "abertura") ?? blueprint.scenes[0];
  const remainingScenes = blueprint.scenes.filter((scene) => scene !== openingScene);
  const mapAnchors = selectContentIdeaCardAnchors(resolveContentIdeaMapAnchors({
    mapAnchors: idea.mapAnchors,
    territory: idea.territory,
    assets: idea.assets,
    tone: idea.tone,
  }));

  return (
    <div>
      <section aria-labelledby="idea-opening-title">
        <div className="flex items-center justify-between gap-3">
          <p id="idea-opening-title" className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
            Comece assim
          </p>
          <CopyButton text={idea.hook} label="Copiar abertura" />
        </div>
        <blockquote className="mt-3 max-w-[30ch] font-display text-[1.34rem] font-bold leading-[1.16] tracking-[-0.025em] text-zinc-950">
          “{idea.hook}”
        </blockquote>
        {openingScene ? (
          <div className="ds-notebook-note mt-4">
            <p className="text-[16px] font-semibold leading-[1.35] text-zinc-800">{openingScene.visual}</p>
            <SceneMeta shot={openingScene.shot} onScreenText={openingScene.onScreenText} durationSeconds={openingScene.durationSeconds} />
          </div>
        ) : null}
      </section>

      <div className="my-8 h-px bg-zinc-100" />

      <section aria-labelledby="storyboard-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-zinc-500">Como gravar</p>
            <h3 id="storyboard-title" className="mt-1 font-display text-[1.55rem] font-bold leading-none tracking-[-0.035em] text-zinc-950">
              Passo a passo do vídeo
            </h3>
          </div>
          <CopyButton text={copyTextForIdea(idea)} label="Copiar plano" />
        </div>
        <p className="mt-3 text-[15px] leading-[1.45] text-zinc-500">{blueprint.visualPremise}</p>

        <div className="mt-6">
          {remainingScenes.map((scene, index) => (
            <motion.article
              key={`${scene.beat}-${index}`}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.055, duration: 0.22 }}
              className="grid grid-cols-[2.75rem_1fr] gap-3 border-t border-zinc-100 py-5 first:border-t-0 first:pt-0"
            >
              <span className="font-display text-[1.45rem] font-bold leading-none tracking-[-0.04em] text-[var(--ds-color-line-strong)]">
                {String(index + 2).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-zinc-400">{BEAT_LABEL[scene.beat]}</p>
                <p className="mt-1 text-[17px] font-semibold leading-[1.35] text-zinc-900">{scene.visual}</p>
                {scene.spokenIntent.trim().toLocaleLowerCase("pt-BR") !== scene.visual.trim().toLocaleLowerCase("pt-BR") ? (
                  <p className="mt-2 text-[15px] leading-[1.5] text-zinc-600">
                    <span className="font-semibold text-zinc-800">O que dizer: </span>{scene.spokenIntent}
                  </p>
                ) : null}
                <SceneMeta shot={scene.shot} onScreenText={scene.onScreenText} durationSeconds={scene.durationSeconds} />
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {idea.opportunityBrief?.timing ? (
        <section className="mt-8 border-y border-zinc-100 py-5" aria-labelledby="idea-timing-title">
          <p id="idea-timing-title" className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
            Quando publicar
          </p>
          <p className="mt-2 font-display text-[1.35rem] font-bold tracking-[-0.03em] text-zinc-950">
            {idea.opportunityBrief.timing.dayLabel}, {idea.opportunityBrief.timing.windowLabel}
          </p>
          <p className="mt-2 text-[14px] leading-[1.45] text-zinc-600">
            {idea.opportunityBrief.timing.reason}
          </p>
        </section>
      ) : null}

      {blueprint.recordingChecklist.length > 0 ? (
        <Checklist title="Antes de gravar" items={blueprint.recordingChecklist} />
      ) : null}

      {(idea.whyItFits || idea.resonanceNote || idea.opportunityBrief || mapAnchors.length > 0) ? (
        <details className="mt-8 border-y border-zinc-100 py-4">
          <summary className="cursor-pointer list-none text-[15px] font-semibold text-zinc-800">
            Por que sugerimos esta ideia <span aria-hidden="true" className="float-right text-zinc-400">＋</span>
          </summary>
          <div className="mt-4 space-y-4 text-[15px] leading-[1.5] text-zinc-600">
            {idea.opportunityBrief?.whyNow ? (
              <p><strong className="text-zinc-800">Por que agora: </strong>{simplifyUserFacingText(idea.opportunityBrief.whyNow, 220)}</p>
            ) : null}
            <p>{idea.opportunityBrief?.evidenceSummary ?? buildOpportunityEvidenceSummary(0)}</p>
            {idea.whyItFits ? <p><strong className="text-zinc-800">O que combina com você: </strong>{simplifyUserFacingText(idea.whyItFits, 300)}</p> : null}
            {idea.resonanceNote ? <p><strong className="text-[var(--ds-color-ink)]">O que as pessoas costumam salvar: </strong>{simplifyUserFacingText(idea.resonanceNote, 220)}</p> : null}
            {mapAnchors.length > 0 ? (
              <ul className="divide-y divide-zinc-100 border-y border-zinc-100">
                {mapAnchors.map((anchor) => (
                  <li key={`${anchor.kind}:${anchor.label}`} className="flex items-start justify-between gap-4 py-3">
                    <span className="text-[12px] font-semibold text-zinc-500">{contentIdeaMapAnchorLabel(anchor.kind)}</span>
                    <span className="text-right text-[13px] font-semibold text-zinc-800">{anchor.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function copyTextForCollab(idea: ContentIdeaListItem, collab: NarrativeCollabMatch): string {
  const blueprint = resolveContentIdeaCollabBlueprint(
    collab.collabBlueprint,
    collab.collabRecordingIdea,
    collab.collabMode,
  );
  return [
    idea.title,
    `COM QUEM\n${collab.name}`,
    collab.narrativeFitReason ? `POR QUE ESSA PESSOA\n${collab.narrativeFitReason}` : "",
    blueprint
      ? blueprint.scenes.map((scene, index) =>
          `${String(index + 1).padStart(2, "0")} · ${ownerLabel(scene.owner, collab.name)} · ${BEAT_LABEL[scene.beat]}\nVISUAL: ${scene.visual}\nO QUE DIZER: ${scene.spokenIntent}`,
        ).join("\n\n")
      : "",
    blueprint?.editPlan ? `COMO JUNTAR OS VÍDEOS\n${blueprint.editPlan}` : "",
    blueprint?.handoffChecklist.length
      ? `COMBINEM ANTES\n${blueprint.handoffChecklist.map((item) => `• ${item}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");
}

function CollabPlan({
  idea,
  collab,
  onOpenCreatorMediaKit,
  reduceMotion,
}: {
  idea: ContentIdeaListItem;
  collab: NarrativeCollabMatch;
  onOpenCreatorMediaKit?: (slug: string) => void;
  reduceMotion: boolean;
}) {
  const blueprint = resolveContentIdeaCollabBlueprint(
    collab.collabBlueprint,
    collab.collabRecordingIdea,
    collab.collabMode,
  );
  const initials = collab.name.trim().slice(0, 1).toUpperCase() || "?";
  const openMediaKit = collab.mediaKitSlug && onOpenCreatorMediaKit
    ? () => onOpenCreatorMediaKit(collab.mediaKitSlug!)
    : undefined;

  return (
    <div>
      <section className="flex items-center gap-4" aria-labelledby="collab-plan-title">
        <button
          type="button"
          disabled={!openMediaKit}
          onClick={openMediaKit}
          className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-950 text-lg font-bold text-white disabled:cursor-default"
          aria-label={openMediaKit ? `Abrir mídia kit de ${collab.name}` : undefined}
        >
          <StableCreatorAvatar
            name={collab.name}
            avatarUrl={collab.avatarUrl}
            creatorId={collab.id}
            mediaKitSlug={collab.mediaKitSlug}
            fallbackText={initials}
          />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">Plano da parceria</p>
          <h3 id="collab-plan-title" className="mt-0.5 truncate font-display text-[1.6rem] font-bold leading-none tracking-[-0.035em] text-zinc-950">
            Você + {collab.name.split(" ")[0]}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {collab.collabMode ? <CollabModeBadge mode={collab.collabMode} /> : null}
            {blueprint?.format ? <span className="text-[13px] text-zinc-500">{blueprint.format}</span> : null}
          </div>
        </div>
      </section>

      {collab.narrativeFitReason ? (
        <p className="mt-5 max-w-[42ch] text-[16px] font-semibold leading-[1.45] text-zinc-800">
          {simplifyUserFacingText(collab.narrativeFitReason, 220)}
        </p>
      ) : null}

      {collab.viewerContribution || collab.partnerContribution ? (
        <div className="ds-notebook-note mt-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-zinc-400">O que cada pessoa faz</p>
        {collab.viewerContribution ? (
            <p className="mt-3 text-[14px] leading-[1.45] text-zinc-600">
              <strong className="text-zinc-800">Você entra com: </strong>{simplifyUserFacingText(collab.viewerContribution, 180)}
          </p>
        ) : null}
        {collab.partnerContribution ? (
          <p className="mt-1 text-[14px] leading-[1.45] text-zinc-600">
              <strong className="text-zinc-800">{collab.name.split(" ")[0]} entra com: </strong>{simplifyUserFacingText(collab.partnerContribution, 180)}
          </p>
        ) : null}
        </div>
      ) : null}

      {blueprint ? (
        <section className="mt-8" aria-labelledby="collab-storyboard-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">Como gravar juntos</p>
              <h4 id="collab-storyboard-title" className="mt-1 font-display text-[1.55rem] font-bold leading-none tracking-[-0.035em] text-zinc-950">
                Quem faz cada parte
              </h4>
            </div>
            <CopyButton text={copyTextForCollab(idea, collab)} label="Copiar plano" />
          </div>

          <div className="mt-5">
            {blueprint.scenes.map((scene, index) => (
              <motion.article
                key={`${scene.owner}-${scene.beat}-${index}`}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : index * 0.06, duration: 0.22 }}
                className="grid grid-cols-[3rem_1fr] gap-3 border-t border-zinc-100 py-5 first:border-t-0 first:pt-0"
              >
                <span className="font-display text-[1.45rem] font-bold leading-none tracking-[-0.04em] text-[var(--ds-color-line-strong)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[var(--ds-color-neutral)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ds-color-text-secondary)]">
                      {ownerLabel(scene.owner, collab.name)}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-400">{BEAT_LABEL[scene.beat]}</span>
                  </div>
                  <p className="mt-2 text-[17px] font-semibold leading-[1.35] text-zinc-900">{scene.visual}</p>
                  <p className="mt-2 text-[15px] leading-[1.5] text-zinc-600">
                    <span className="font-semibold text-zinc-800">O que dizer: </span>{scene.spokenIntent}
                  </p>
                  {scene.transition ? <p className="mt-2 text-[13px] leading-[1.4] text-zinc-500">Depois: {scene.transition}</p> : null}
                </div>
              </motion.article>
            ))}
          </div>

          <div className="mt-3 border-y border-zinc-100 py-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-zinc-400">Como juntar os vídeos</p>
            <p className="mt-2 text-[16px] leading-[1.5] text-zinc-700">{blueprint.editPlan}</p>
          </div>

          {blueprint.handoffChecklist.length > 0 ? <Checklist title="Combinem antes" items={blueprint.handoffChecklist} /> : null}
        </section>
      ) : null}

      {collab.sharedSignal || collab.distinctSignals.length > 0 ? (
        <details className="mt-8 border-y border-zinc-100 py-4">
          <summary className="cursor-pointer list-none text-[15px] font-semibold text-zinc-800">
            Por que vocês combinam <span aria-hidden="true" className="float-right text-zinc-400">＋</span>
          </summary>
          <div className="mt-4 space-y-3 text-[14px] leading-[1.5] text-zinc-600">
            {collab.sharedSignal ? (
              <p><strong className="text-zinc-800">Assunto em comum: </strong>{collab.sharedSignal}</p>
            ) : null}
            {collab.distinctSignals.length > 0 ? (
              <p><strong className="text-zinc-800">O que {collab.name.split(" ")[0]} acrescenta: </strong>{collab.distinctSignals.join(", ")}</p>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function SceneMeta({ shot, onScreenText, durationSeconds }: { shot: string | null; onScreenText: string | null; durationSeconds: number | null }) {
  if (!shot && !onScreenText && !durationSeconds) return null;
  const plainShot = shot
    ?.replace(/plano pr[oó]ximo/gi, "câmera próxima")
    .replace(/plano m[eé]dio/gi, "câmera da cintura para cima")
    .replace(/plano aberto/gi, "câmera mais afastada")
    .replace(/close[- ]?up/gi, "câmera próxima");
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] leading-[1.4] text-zinc-500">
      {plainShot ? <span>{plainShot}</span> : null}
      {durationSeconds ? <span>{durationSeconds}s</span> : null}
      {onScreenText ? <span className="basis-full text-zinc-600">Na tela: “{onScreenText}”</span> : null}
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-8" aria-label={title}>
      <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-zinc-400">{title}</p>
      <ul className="mt-3 divide-y divide-zinc-100 border-y border-zinc-100">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-3 py-3 text-[15px] leading-[1.45] text-zinc-700">
            <span className="mt-0.5 text-[var(--ds-color-ink)]">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CollabContextTeaser({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <button
      type="button"
      onClick={onUpgrade}
      className="mt-8 flex w-full items-center gap-3 border-y border-[var(--ds-color-line)] py-5 text-left"
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--ds-color-ink)] text-lg font-extrabold text-[var(--ds-color-on-brand)]"
      >
        ?
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-zinc-950">Esta ideia também pode ser feita em parceria</span>
        <span className="mt-0.5 block text-[13px] text-[var(--ds-color-text-secondary)]">Veja uma sugestão e como vocês podem gravar →</span>
      </div>
    </button>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard pode estar bloqueado em webviews; a leitura segue intacta.
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ds-button ds-button--quiet ds-button--small !min-h-0 shrink-0 !px-3 !py-2 text-[12px]"
      aria-label={label}
    >
      {copied ? "✓ Copiado" : label}
    </button>
  );
}
