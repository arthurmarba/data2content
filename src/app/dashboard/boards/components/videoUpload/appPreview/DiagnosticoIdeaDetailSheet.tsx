"use client";

import { useState, useCallback } from "react";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import { DiagnosticoCloseButton } from "./DiagnosticoCloseButton";

interface Props {
  idea: ContentIdeaListItem;
  /** Criador compatível pela pauta (Pro). null = sem match / ainda não buscado. */
  collab?: NarrativeCollabMatch | null;
  isPro?: boolean;
  onOpenCreatorMediaKit?: (slug: string) => void;
  onUpgrade?: () => void;
  onClose: () => void;
}

export function DiagnosticoIdeaDetailSheet({ idea, collab, isPro = false, onOpenCreatorMediaKit, onUpgrade, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[270] flex items-end bg-zinc-950/40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Pauta"
        className="max-h-[calc(100dvh-env(safe-area-inset-top,0px)-1.75rem)] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-zinc-200 bg-white shadow-[0_28px_80px_rgba(24,24,27,0.18)] animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mb-2 flex justify-center pt-4" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-4 pb-5">
          <div className="min-w-0 flex-1">
            {/* Formato como badge/pill */}
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.7px] text-violet-700 mb-2 whitespace-nowrap">
              {idea.suggestedFormat}
            </span>
            <h2 className="text-[19px] font-bold tracking-tight text-zinc-950 leading-snug">
              {idea.title}
            </h2>
          </div>
          <div className="mt-0.5 shrink-0">
            <DiagnosticoCloseButton onClose={onClose} edgeAlign />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-100 mx-6" />

        <div className="px-6 pb-8 flex flex-col gap-6 pt-5">
          {/* Abertura — bloco destacado com fundo lavanda */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-zinc-500 mb-2.5">
              Como você abre
            </p>
            <div className="rounded-2xl bg-violet-50 px-5 py-4">
              <p className="text-[14.5px] italic leading-relaxed text-violet-900">
                &ldquo;{idea.hook}&rdquo;
              </p>
            </div>
          </div>

          {/* Direcional — script points numerados */}
          {(idea.scriptPoints.length > 0 || idea.scriptClosing) && (
            <div className="rounded-2xl bg-zinc-50 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-zinc-500 mb-4">
                O caminho do vídeo
              </p>
              {idea.scriptPoints.length > 0 && (
                <ol className="flex flex-col gap-3.5">
                  {idea.scriptPoints.map((point, i) => (
                    <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-zinc-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ol>
              )}
              {idea.scriptClosing && (
                <p className="mt-4 pt-4 border-t border-zinc-200 text-[13px] leading-relaxed text-zinc-500">
                  <span className="font-semibold text-zinc-600">Fecha com:</span>{" "}
                  {idea.scriptClosing}
                </p>
              )}
            </div>
          )}

          {/* Por que é a sua cara — metade-MAPA do encontro */}
          {idea.whyItFits && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-zinc-500 mb-2">
                Por que é a sua cara
              </p>
              <p className="text-[13.5px] leading-relaxed text-zinc-600">
                {idea.whyItFits}
              </p>
            </div>
          )}

          {/* O que mais reconhecem em você — metade-AUDIÊNCIA do encontro.
              Verde = identidade da audiência. Só aparece quando o roteiro cai
              num sinal de reconhecimento (o "match" mapa × audiência). */}
          {idea.resonanceNote && (
            <div className="rounded-2xl bg-green-50 px-5 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.8px] text-green-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                O que mais reconhecem em você
              </p>
              <p className="text-[13.5px] leading-relaxed text-green-900">
                {idea.resonanceNote}
              </p>
            </div>
          )}

          {/* Collab — criador compatível pela pauta. Pro vê o match real (razão +
              como gravar a dois); free vê o teaser que abre o paywall. */}
          {collab ? (
            <CollabContextBlock collab={collab} onOpenCreatorMediaKit={onOpenCreatorMediaKit} />
          ) : !isPro ? (
            <CollabContextTeaser onUpgrade={onUpgrade} />
          ) : null}

          {/* Chips — separador sutil + território e tom, sem quebra interna */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100">
            <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
              {idea.territory}
            </span>
            {idea.tone && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 whitespace-nowrap">
                {idea.tone}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Collab context (Pro) ──────────────────────────────────────────────────────

function CollabContextBlock({
  collab,
  onOpenCreatorMediaKit,
}: {
  collab: NarrativeCollabMatch;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  const initials = (collab.name || "?").trim().slice(0, 1).toUpperCase();
  const open = collab.mediaKitSlug && onOpenCreatorMediaKit
    ? () => onOpenCreatorMediaKit(collab.mediaKitSlug!)
    : undefined;
  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-5 py-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.8px] text-violet-700">
        Collab pra essa pauta
      </p>
      {/* Criador */}
      <button
        type="button"
        onClick={open}
        disabled={!open}
        className="flex w-full items-center gap-3 text-left disabled:cursor-default"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-900 text-[15px] font-bold text-white">
          {collab.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={collab.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : initials}
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold tracking-tight text-zinc-950">
            {collab.name}
          </span>
          {collab.sharedSignal ? (
            <span className="block truncate text-[12px] text-violet-700">
              Ponto em comum: {collab.sharedSignal}
            </span>
          ) : null}
        </div>
        {open ? <span className="shrink-0 text-[13px] text-zinc-400">Ver ›</span> : null}
      </button>

      {/* Por que combina */}
      <div className="mt-4">
        <p className="text-[11px] font-bold tracking-tight text-zinc-500">Por que {collab.name.split(" ")[0]} combina</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-zinc-700">{collab.narrativeFitReason}</p>
      </div>

      {/* Como gravar a dois */}
      {collab.collabRecordingIdea ? (
        <div className="mt-3.5 border-t border-violet-100 pt-3.5">
          <p className="text-[11px] font-bold tracking-tight text-zinc-500">Como gravar essa collab</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-zinc-700">{collab.collabRecordingIdea}</p>
        </div>
      ) : null}
    </div>
  );
}

function CollabContextTeaser({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <button
      type="button"
      onClick={onUpgrade}
      className="flex w-full items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-5 py-4 text-left"
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full"
        style={{ background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)" }}
      >
        <span className="text-[18px] font-extrabold text-white" style={{ textShadow: "0 1px 2px rgba(76,29,149,0.45)" }}>?</span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold tracking-tight text-zinc-950">
          Um criador combina com essa pauta
        </span>
        <span className="mt-0.5 block text-[12.5px] font-semibold text-violet-700">
          Descubra quem — e como gravar juntos — no Pro →
        </span>
      </div>
    </button>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard indisponível — silencioso
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copiar abertura"
      className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 active:bg-zinc-200 transition-colors"
    >
      {copied ? (
        <span className="text-emerald-600">✓ Copiado</span>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Copiar abertura
        </>
      )}
    </button>
  );
}
