"use client";

import { useCallback, useMemo, useState } from "react";
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
import { color } from "@/design-system";

interface Props {
  idea: ContentIdeaListItem;
  collab?: NarrativeCollabMatch | null;
  isPro?: boolean;
  decisionPending?: boolean;
  onDecide?: (decision: "interested" | "dismissed") => void;
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
  if (owner === "partner") return partnerName.split(" ")[0] || "Outro creator";
  return "Os dois";
}

function copyTextForIdea(idea: ContentIdeaListItem): string {
  const blueprint = resolveContentIdeaScriptBlueprint(idea.scriptBlueprint, idea);
  return [
    idea.title,
    idea.angle,
    `ABERTURA\n${idea.hook}`,
    ...blueprint.scenes.map((scene, index) =>
      `${String(index + 1).padStart(2, "0")} · ${BEAT_LABEL[scene.beat]}\nVISUAL: ${scene.visual}\nINTENÇÃO: ${scene.spokenIntent}`,
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
  awaitingOtherSide = false,
  onOpenCreatorMediaKit,
  onUpgrade,
  onClose,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [activePlan, setActivePlan] = useState<"solo" | "collab">(collab ? "collab" : "solo");
  const blueprint = useMemo(
    () => resolveContentIdeaScriptBlueprint(idea.scriptBlueprint, idea),
    [idea],
  );
  const mapAnchors = useMemo(
    () => selectContentIdeaCardAnchors(resolveContentIdeaMapAnchors({
      mapAnchors: idea.mapAnchors,
      territory: idea.territory,
      assets: idea.assets,
      tone: idea.tone,
    })),
    [idea],
  );

  return (
    <div
      className="fixed inset-0 z-[270] flex items-end justify-center ds-scrim sm:items-center sm:p-4"
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
        className="flex h-[100dvh] w-full max-w-[32rem] flex-col overflow-hidden bg-white text-zinc-950 shadow-2xl sm:h-auto sm:max-h-[min(94dvh,860px)] sm:rounded-[2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-zinc-100 bg-white px-5 pb-5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-7 sm:pt-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-zinc-500">
              <span className="text-violet-700">{idea.suggestedFormat}</span>
              <span aria-hidden="true" className="text-zinc-300">/</span>
              <span className="truncate">{idea.territory}</span>
              {blueprint.estimatedDurationSeconds ? (
                <>
                  <span aria-hidden="true" className="text-zinc-300">/</span>
                  <span>{blueprint.estimatedDurationSeconds}s</span>
                </>
              ) : null}
            </div>
            <DiagnosticoCloseButton onClose={onClose} edgeAlign />
          </div>

          <h2
            id="idea-detail-title"
            className="max-w-[12ch] font-display text-[clamp(1.95rem,8.4vw,2.4rem)] font-bold leading-[0.98] tracking-[-0.048em] text-zinc-950"
          >
            {idea.title}
          </h2>
          {idea.angle ? (
            <p className="mt-3 max-w-[38ch] text-[16px] leading-[1.45] text-zinc-600">
              {idea.angle}
            </p>
          ) : null}

          {mapAnchors.length > 0 ? (
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-violet-700">Do seu mapa</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {mapAnchors.map((anchor) => (
                  <span
                    key={`${anchor.kind}:${anchor.label}`}
                    className="grid min-w-0 grid-cols-1 rounded-xl bg-zinc-100 px-2.5 py-2 text-zinc-800"
                    title={`${contentIdeaMapAnchorLabel(anchor.kind)}: ${anchor.label}`}
                  >
                    <span className="truncate text-[8px] font-bold uppercase tracking-[0.04em] text-zinc-500">{contentIdeaMapAnchorLabel(anchor.kind)}</span>
                    <span className="mt-1 truncate text-[11px] font-semibold leading-none">{anchor.label}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {collab ? (
            <div className="mt-5 inline-flex rounded-full bg-zinc-100 p-1" aria-label="Escolha do plano">
              <PlanToggle active={activePlan === "solo"} onClick={() => setActivePlan("solo")}>Solo</PlanToggle>
              <PlanToggle active={activePlan === "collab"} onClick={() => setActivePlan("collab")}>A dois</PlanToggle>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-10 pt-6 sm:px-7">
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

          {!collab && !isPro ? <CollabContextTeaser onUpgrade={onUpgrade} /> : null}
        </div>

        {decisionPending && onDecide ? (
          <div className="shrink-0 border-t border-zinc-100 bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-7">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onDecide("dismissed")}
                aria-label="Não agora"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-transform active:scale-95"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onDecide("interested")}
                className="ds-button ds-button--primary min-h-12 flex-1"
              >
                Quero fazer essa collab
              </button>
            </div>
          </div>
        ) : awaitingOtherSide ? (
          <div className="shrink-0 border-t border-violet-100 bg-violet-50 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center sm:px-7">
            <p className="text-[14px] font-semibold text-violet-800">
              Você topou — aguardando o outro lado
            </p>
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}

function PlanToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${active ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"}`}
    >
      {children}
    </button>
  );
}

function SoloPlan({ idea, reduceMotion }: { idea: ContentIdeaListItem; reduceMotion: boolean }) {
  const blueprint = resolveContentIdeaScriptBlueprint(idea.scriptBlueprint, idea);
  const openingScene = blueprint.scenes.find((scene) => scene.beat === "abertura") ?? blueprint.scenes[0];
  const remainingScenes = blueprint.scenes.filter((scene) => scene !== openingScene);

  return (
    <div>
      <section aria-labelledby="idea-opening-title">
        <div className="flex items-center justify-between gap-3">
          <p id="idea-opening-title" className="text-[12px] font-bold uppercase tracking-[0.09em] text-violet-700">
            Comece assim
          </p>
          <CopyButton text={idea.hook} label="Copiar abertura" />
        </div>
        <blockquote className="mt-3 max-w-[30ch] font-display text-[1.34rem] font-bold leading-[1.16] tracking-[-0.025em] text-zinc-950">
          “{idea.hook}”
        </blockquote>
        {openingScene ? (
          <div className="mt-4 border-l-2 border-violet-200 pl-4">
            <p className="text-[16px] font-semibold leading-[1.35] text-zinc-800">{openingScene.visual}</p>
            <SceneMeta shot={openingScene.shot} onScreenText={openingScene.onScreenText} durationSeconds={openingScene.durationSeconds} />
          </div>
        ) : null}
      </section>

      <div className="my-8 h-px bg-zinc-100" />

      <section aria-labelledby="storyboard-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-zinc-500">Storyboard</p>
            <h3 id="storyboard-title" className="mt-1 font-display text-[1.55rem] font-bold leading-none tracking-[-0.035em] text-zinc-950">
              O caminho do vídeo
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
              <span className="font-display text-[1.45rem] font-bold leading-none tracking-[-0.04em] text-violet-300">
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

      {blueprint.recordingChecklist.length > 0 ? (
        <Checklist title="Antes de gravar" items={blueprint.recordingChecklist} />
      ) : null}

      {(idea.whyItFits || idea.resonanceNote) ? (
        <details className="mt-8 border-y border-zinc-100 py-4">
          <summary className="cursor-pointer list-none text-[15px] font-semibold text-zinc-800">
            Por que essa ideia faz sentido <span aria-hidden="true" className="float-right text-zinc-400">＋</span>
          </summary>
          <div className="mt-4 space-y-4 text-[15px] leading-[1.5] text-zinc-600">
            {idea.whyItFits ? <p><strong className="text-zinc-800">No seu mapa: </strong>{idea.whyItFits}</p> : null}
            {idea.resonanceNote ? <p><strong className="text-emerald-700">No que reconhecem em você: </strong>{idea.resonanceNote}</p> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function CollabPlan({
  collab,
  onOpenCreatorMediaKit,
  reduceMotion,
}: {
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
          className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-950 text-lg font-bold text-white disabled:cursor-default"
          aria-label={openMediaKit ? `Abrir mídia kit de ${collab.name}` : undefined}
        >
          {collab.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={collab.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : initials}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-violet-700">Plano a dois</p>
          <h3 id="collab-plan-title" className="mt-0.5 truncate font-display text-[1.6rem] font-bold leading-none tracking-[-0.035em] text-zinc-950">
            Você + {collab.name.split(" ")[0]}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {collab.collabMode ? <CollabModeBadge mode={collab.collabMode} /> : null}
            {blueprint?.format ? <span className="text-[13px] text-zinc-500">{blueprint.format}</span> : null}
          </div>
        </div>
      </section>

      <div className="mt-6 border-l-2 border-violet-200 pl-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-zinc-400">Por que vocês</p>
        <p className="mt-1 text-[16px] font-semibold leading-[1.45] text-zinc-800">{collab.narrativeFitReason}</p>
        {collab.sharedSignal ? (
          <p className="mt-2 text-[14px] leading-[1.45] text-zinc-500">
            <strong className="text-zinc-700">Ponto em comum:</strong> {collab.sharedSignal}
          </p>
        ) : null}
        {collab.distinctSignals.length > 0 ? (
          <p className="mt-1 text-[14px] leading-[1.45] text-zinc-500">
            <strong className="text-zinc-700">Ela/ele traz:</strong> {collab.distinctSignals.join(", ")}
          </p>
        ) : null}
      </div>

      {blueprint ? (
        <section className="mt-8" aria-labelledby="collab-storyboard-title">
          <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-violet-700">Como gravar essa collab</p>
          <h4 id="collab-storyboard-title" className="mt-1 font-display text-[1.55rem] font-bold leading-none tracking-[-0.035em] text-zinc-950">
            Quem faz o quê
          </h4>

          <div className="mt-5">
            {blueprint.scenes.map((scene, index) => (
              <motion.article
                key={`${scene.owner}-${scene.beat}-${index}`}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : index * 0.06, duration: 0.22 }}
                className="grid grid-cols-[3rem_1fr] gap-3 border-t border-zinc-100 py-5 first:border-t-0 first:pt-0"
              >
                <span className="font-display text-[1.45rem] font-bold leading-none tracking-[-0.04em] text-violet-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-violet-700">
                      {ownerLabel(scene.owner, collab.name)}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-400">{BEAT_LABEL[scene.beat]}</span>
                  </div>
                  <p className="mt-2 text-[17px] font-semibold leading-[1.35] text-zinc-900">{scene.visual}</p>
                  <p className="mt-2 text-[15px] leading-[1.5] text-zinc-600">
                    <span className="font-semibold text-zinc-800">Intenção: </span>{scene.spokenIntent}
                  </p>
                  {scene.transition ? <p className="mt-2 text-[13px] italic leading-[1.4] text-zinc-500">Transição: {scene.transition}</p> : null}
                </div>
              </motion.article>
            ))}
          </div>

          <div className="mt-3 border-y border-zinc-100 py-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-zinc-400">Na edição</p>
            <p className="mt-2 text-[16px] leading-[1.5] text-zinc-700">{blueprint.editPlan}</p>
          </div>

          {blueprint.handoffChecklist.length > 0 ? <Checklist title="Combinem antes" items={blueprint.handoffChecklist} /> : null}
        </section>
      ) : null}
    </div>
  );
}

function SceneMeta({ shot, onScreenText, durationSeconds }: { shot: string | null; onScreenText: string | null; durationSeconds: number | null }) {
  if (!shot && !onScreenText && !durationSeconds) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] leading-[1.4] text-zinc-500">
      {shot ? <span>{shot}</span> : null}
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
            <span className="mt-0.5 text-violet-500">✓</span>
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
      className="mt-8 flex w-full items-center gap-3 border-y border-violet-100 py-5 text-left"
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-extrabold text-white"
        style={{ background: `linear-gradient(135deg, ${color.brandSoft}, ${color.brand})` }}
      >
        ?
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-zinc-950">Um creator combina com essa ideia</span>
        <span className="mt-0.5 block text-[13px] text-violet-700">Veja quem e receba o plano de gravação a dois →</span>
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
      className="shrink-0 rounded-full bg-zinc-100 px-3 py-2 text-[12px] font-semibold text-zinc-600 transition-colors active:bg-zinc-200"
      aria-label={label}
    >
      {copied ? "✓ Copiado" : label}
    </button>
  );
}
