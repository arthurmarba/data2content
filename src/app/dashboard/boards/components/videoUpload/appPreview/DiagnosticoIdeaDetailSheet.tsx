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
  /**
   * True quando a pauta está na pilha com decisão em aberto — a ficha mostra a
   * MESMA ação da pilha (não agora / quero fazer). Um gesto, dois lugares,
   * uma decisão.
   */
  decisionPending?: boolean;
  /** Registra a decisão (a ficha fecha em seguida — o shell cuida disso). */
  onDecide?: (decision: "interested" | "dismissed") => void;
  /** True quando o criador já topou e o outro lado ainda não respondeu. */
  awaitingOtherSide?: boolean;
  onOpenCreatorMediaKit?: (slug: string) => void;
  onUpgrade?: () => void;
  onClose: () => void;
}

export function DiagnosticoIdeaDetailSheet({ idea, collab, isPro = false, decisionPending = false, onDecide, awaitingOtherSide = false, onOpenCreatorMediaKit, onUpgrade, onClose }: Props) {
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
          {/* O roteiro — uma linha do tempo só (abre → passos → fecha), ligada
              por um traço vertical. Antes eram 2 etiquetas + 1 parágrafo
              especial pra descrever o que é, na essência, UM caminho contínuo
              (o "fecha com" era o último passo do roteiro, só estilizado como
              se fosse outra coisa). Um tamanho de leitura só (14px) pra toda
              a prosa — a hierarquia vem do marcador (play/número/check), não
              do tamanho da fonte. Resolve também o roteiro parecendo raso:
              2-3 passos soltos numa caixa vazia liam como pouco; os mesmos
              2-3 passos como elos de uma corrente leem como o caminho inteiro. */}
          {(idea.hook || idea.scriptPoints.length > 0 || idea.scriptClosing) ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-zinc-400 mb-3">
                O roteiro
              </p>
              <div className="relative flex flex-col gap-4">
                {/* Traço vertical contínuo, atrás dos marcadores. */}
                <div className="absolute left-[10.5px] top-3 bottom-3 w-px bg-violet-100" aria-hidden="true" />

                {idea.hook ? (
                  <div className="relative flex gap-3">
                    <span className="relative z-10 mt-0.5 grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full bg-violet-600">
                      <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5l11 7-11 7V5z" fill="#fff" />
                      </svg>
                    </span>
                    <p className="text-[14px] italic leading-relaxed text-zinc-700 pt-0.5">
                      &ldquo;{idea.hook}&rdquo;
                    </p>
                  </div>
                ) : null}

                {idea.scriptPoints.map((point, i) => (
                  <div key={i} className="relative flex gap-3">
                    <span className="relative z-10 mt-0.5 grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full bg-violet-50 text-[10px] font-bold text-violet-600">
                      {i + 1}
                    </span>
                    <p className="text-[14px] leading-relaxed text-zinc-700 pt-0.5">{point}</p>
                  </div>
                ))}

                {idea.scriptClosing ? (
                  <div className="relative flex gap-3">
                    <span className="relative z-10 mt-0.5 grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full bg-violet-600">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12l5 5 9-10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <p className="text-[14px] leading-relaxed text-zinc-700 pt-0.5">
                      <span className="font-semibold text-zinc-600">Fecha com:</span> {idea.scriptClosing}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Por que é a sua cara — não é um passo do roteiro, é a razão por
              trás dele. Fica fora da linha do tempo de propósito: é reflexão,
              não execução. */}
          {idea.whyItFits ? (
            <p className="text-[14px] leading-relaxed text-zinc-500 border-t border-zinc-100 pt-4">
              <span className="font-semibold text-zinc-600">Por que é a sua cara: </span>
              {idea.whyItFits}
            </p>
          ) : null}

          {/* O que mais reconhecem em você — metade-AUDIÊNCIA do encontro.
              Verde = identidade da audiência. Só aparece quando o roteiro cai
              num sinal de reconhecimento (o "match" mapa × audiência). */}
          {idea.resonanceNote && (
            <div className="rounded-2xl bg-green-50 px-5 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.8px] text-green-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                O que mais reconhecem em você
              </p>
              <p className="text-[14px] leading-relaxed text-green-900">
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

        {/* Decisão da pilha — mesma ação, dentro da ficha. Sticky pro criador
            decidir depois de ler o roteiro inteiro sem voltar pra pilha. */}
        {decisionPending && onDecide ? (
          <div className="sticky bottom-0 flex items-center justify-center gap-5 border-t border-zinc-100 bg-white/95 px-6 py-4 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => onDecide("dismissed")}
              aria-label="Não agora"
              className="grid h-12 w-12 place-items-center rounded-full border-[1.5px] border-zinc-200 bg-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="#a1a1aa" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onDecide("interested")}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-violet-600 px-6 text-[14px] font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] transition-transform duration-150 active:scale-[0.97]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 20.3l-7.1-6.8a4.6 4.6 0 0 1 0-6.7 5 5 0 0 1 6.9 0l.2.2.2-.2a5 5 0 0 1 6.9 0 4.6 4.6 0 0 1 0 6.7L12 20.3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              Quero fazer essa collab
            </button>
          </div>
        ) : awaitingOtherSide ? (
          <div className="border-t border-zinc-100 bg-violet-50/50 px-6 py-3.5 text-center">
            <p className="text-[12.5px] font-semibold text-violet-700">
              Você topou — aguardando o outro lado
            </p>
          </div>
        ) : null}
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
    // Sombra roxa difusa em vez de borda — mesmo idioma do "prêmio" no card do
    // deck: uma pessoa merece peso próprio, sem virar caixa-dentro-de-caixa.
    <div
      className="rounded-2xl bg-violet-50/60 px-5 py-4"
      style={{ boxShadow: "0 2px 8px rgba(124,58,237,0.10), 0 14px 32px rgba(124,58,237,0.16)" }}
    >
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
      <div className="mt-4 flex flex-col gap-3">
        {collab.sharedSignal && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-zinc-400">Ponto em comum</p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-zinc-700">
              {collab.sharedSignal} <span className="text-zinc-400">— vocês dois já vivem isso</span>
            </p>
          </div>
        )}

        {collab.distinctSignals && collab.distinctSignals.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-zinc-400">Ela/ele traz</p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-zinc-700">
              {collab.distinctSignals.join(", ")} <span className="text-zinc-400">— o ângulo que você não cobre</span>
            </p>
          </div>
        )}

        <div>
          <p className="text-[11px] font-bold tracking-tight text-zinc-500 uppercase">Por que {collab.name.split(" ")[0]} combina</p>
          <p className="mt-1 text-[14px] leading-relaxed text-zinc-700">{collab.narrativeFitReason}</p>
        </div>
      </div>

      {/* Como gravar a dois */}
      {collab.collabRecordingIdea ? (
        <div className="mt-3.5 border-t border-violet-100 pt-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold tracking-tight text-zinc-500">Como gravar essa collab</p>
            {collab.collabMode === "presencial" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.5px] text-zinc-600">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="2" />
                </svg>
                Presencial · mesma cidade
              </span>
            )}
            {collab.collabMode === "remoto" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.5px] text-zinc-600">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                  <path d="M5 12a7 7 0 0 1 14 0" />
                  <path d="M8.5 12a3.5 3.5 0 0 1 7 0" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
                À distância
              </span>
            )}
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-zinc-700">{collab.collabRecordingIdea}</p>
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
      className="flex w-full items-center gap-3 rounded-2xl bg-violet-50/60 px-5 py-4 text-left"
      style={{ boxShadow: "0 2px 8px rgba(124,58,237,0.10), 0 14px 32px rgba(124,58,237,0.16)" }}
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
