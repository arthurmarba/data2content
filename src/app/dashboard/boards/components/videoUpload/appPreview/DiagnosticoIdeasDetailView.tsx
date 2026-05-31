"use client";

import { useState, useCallback } from "react";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { DiagnosticoDetailEmptyState } from "./DiagnosticoDetailEmptyState";
import { CATEGORY_META } from "./DiagnosticoCategoryMeta";
import { CARD_BASE, CARD_P, HC } from "./diagnosticoTokens";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { ContentIdeasReadiness } from "@/app/dashboard/boards/videoUpload/contentIdeasReadinessGate";

interface Props {
  ideas: ContentIdeaListItem[];
  readiness: ContentIdeasReadiness;
  onClose: () => void;
  onOpenIdea?: (ideaId: string) => void;
}

type GenerationState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "error"; message: string }
  | { status: "quota_exceeded"; message: string; resetAt?: string };

export function DiagnosticoIdeasDetailView({ ideas: initialIdeas, readiness, onClose, onOpenIdea }: Props) {
  const meta = CATEGORY_META.ideas;
  const [ideas, setIdeas] = useState<ContentIdeaListItem[]>(initialIdeas);
  const [generation, setGeneration] = useState<GenerationState>({ status: "idle" });

  const handleGenerate = useCallback(async () => {
    setGeneration({ status: "generating" });
    try {
      const response = await fetch(
        "/api/dashboard/mobile-strategic-profile/content-ideas/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 3 }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) {
          setGeneration({
            status: "quota_exceeded",
            message: data?.message ?? "Você atingiu o limite de roteiros deste mês.",
            resetAt: data?.resetAt ?? undefined,
          });
        } else {
          setGeneration({
            status: "error",
            message: data?.message ?? "Não foi possível gerar roteiros agora.",
          });
        }
        return;
      }
      const newIdeas = (data?.ideas ?? []) as Array<{
        id: string;
        title: string;
        angle: string;
        hook: string;
        territory: string;
        assets: string[];
        suggestedFormat: string;
        tone: string | null;
        whyItFits: string;
        scriptPoints?: string[];
        scriptClosing?: string | null;
        resonanceNote?: string | null;
        generatedAt: string;
      }>;
      // Prepend new ideas, mark them as "active"
      setIdeas((prev) => [
        ...newIdeas.map((i) => ({
          ...i,
          scriptPoints: i.scriptPoints ?? [],
          scriptClosing: i.scriptClosing ?? null,
          resonanceNote: i.resonanceNote ?? null,
          status: "active" as const,
          scheduledFor: null,
        })),
        ...prev,
      ]);
      setGeneration({ status: "idle" });
    } catch (err) {
      setGeneration({
        status: "error",
        message: err instanceof Error ? err.message : "Erro inesperado.",
      });
    }
  }, []);

  const updateIdeaStatus = useCallback(
    async (ideaId: string, status: "saved" | "dismissed" | "active" | "posted") => {
      // Optimistic update
      setIdeas((prev) =>
        status === "dismissed"
          ? prev.filter((i) => i.id !== ideaId)
          : prev.map((i) => (i.id === ideaId ? { ...i, status } : i)),
      );
      try {
        await fetch(`/api/dashboard/mobile-strategic-profile/content-ideas/${ideaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
      } catch {
        // Non-fatal — next page load will reconcile
      }
    },
    [],
  );

  const savedIdeas = ideas.filter((i) => i.status === "saved");
  const activeIdeas = ideas.filter((i) => i.status === "active");
  const postedCount = ideas.filter((i) => i.status === "posted").length;

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
    >
      {!readiness.ready ? (
        <DiagnosticoDetailEmptyState
          iconBg="bg-emerald-50"
          iconSlot={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18h6M10 21h4M12 3a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v.3h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 3z" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          title="Roteiros surgem quando seu mapa está pronto"
          description={readiness.nextStep ?? "Continue confirmando dimensões do seu mapa."}
        />
      ) : (
        <div className="flex flex-col gap-3 px-2">
          {/* Generate / refresh button */}
          <div className="flex flex-col gap-2">
            {generation.status === "quota_exceeded" ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                <p className="text-[14px] font-semibold text-amber-800">Roteiros do mês esgotados</p>
                <p className="mt-1 text-[13px] leading-relaxed text-amber-700">
                  {generation.message}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generation.status === "generating"}
                className="rounded-full bg-zinc-950 px-5 py-3 text-[14px] font-semibold text-white transition-opacity disabled:opacity-60 active:bg-zinc-800"
              >
                {generation.status === "generating"
                  ? "Gerando roteiros…"
                  : ideas.length === 0
                  ? "Gerar meus primeiros roteiros"
                  : "Gerar 3 novos roteiros"}
              </button>
            )}
            {generation.status === "error" && (
              <p className="text-[13px] text-rose-600">{generation.message}</p>
            )}
            <p className="text-center text-[12px] text-zinc-400">
              Roteiros gerados a partir do seu mapa confirmado — não de tendências.
            </p>
          </div>

          {/* Empty state when no ideas yet */}
          {ideas.length === 0 && generation.status === "idle" && (
            <div className="mt-4 rounded-2xl bg-white p-5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[14px] text-zinc-500">
                Você ainda não gerou roteiros. Quando gerar, eles aparecem aqui — calmos, conectados ao seu mapa.
              </p>
            </div>
          )}

          {/* ── Roteiros guardados ── */}
          {savedIdeas.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="px-1 text-[12px] font-bold uppercase tracking-widest text-zinc-400">
                Guardados ({savedIdeas.length})
              </p>
              {savedIdeas.map((idea) => (
                <SavedIdeaCard
                  key={idea.id}
                  idea={idea}
                  onUnsave={() => updateIdeaStatus(idea.id, "active")}
                  onOpen={onOpenIdea ? () => onOpenIdea(idea.id) : undefined}
                />
              ))}
              {postedCount > 0 && (
                <p className="px-1 text-center text-[11px] text-zinc-400">
                  {postedCount} roteiro{postedCount !== 1 ? "s" : ""} já postado{postedCount !== 1 ? "s" : ""} ✓
                </p>
              )}
            </div>
          )}

          {/* ── Novos roteiros ── */}
          {activeIdeas.length > 0 && (
            <div className="flex flex-col gap-3">
              {savedIdeas.length > 0 && (
                <p className="px-1 text-[12px] font-bold uppercase tracking-widest text-zinc-400">
                  Novos roteiros
                </p>
              )}
              {activeIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onSave={() => updateIdeaStatus(idea.id, "saved")}
                  onDismiss={() => updateIdeaStatus(idea.id, "dismissed")}
                  onOpen={onOpenIdea ? () => onOpenIdea(idea.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </DiagnosticoCategoryDetailView>
  );
}

// ─── Saved Idea Card — versão enxuta (guardados) ─────────────────────────────

interface SavedIdeaCardProps {
  idea: ContentIdeaListItem;
  onUnsave: () => void;
  onOpen?: () => void;
}

function SavedIdeaCard({ idea, onUnsave, onOpen }: SavedIdeaCardProps) {
  return (
    <div className={CARD_BASE}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="w-full text-left disabled:cursor-default"
      >
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
              ✓ Guardado
            </span>
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
              {idea.territory}
            </span>
            {idea.resonanceNote && (
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500"
                title="O que as pessoas mais reconhecem em você"
                aria-label="O que as pessoas mais reconhecem em você"
              />
            )}
            <span className="ml-auto text-[11px] text-zinc-400">{idea.suggestedFormat}</span>
            {onOpen && <span className="text-[13px] text-zinc-300">›</span>}
          </div>
          <h3 className="text-[16px] font-bold tracking-tight text-zinc-950 leading-snug mb-2">
            {idea.title}
          </h3>
          <p className="text-[13px] italic leading-relaxed text-zinc-500 line-clamp-2">
            &ldquo;{idea.hook}&rdquo;
          </p>
        </div>
      </button>
      <div className="flex gap-2 px-5 pb-5 pt-1">
        <button
          type="button"
          onClick={onUnsave}
          className="rounded-full bg-zinc-50 px-4 py-2.5 text-[13px] font-semibold text-zinc-400 transition-colors active:bg-zinc-100"
        >
          Retirar
        </button>
      </div>
    </div>
  );
}

// ─── Idea Card — versão enxuta (índice da lista) ─────────────────────────────

interface IdeaCardProps {
  idea: ContentIdeaListItem;
  onSave: () => void;
  onDismiss: () => void;
  onOpen?: () => void;
}

function IdeaCard({ idea, onSave, onDismiss, onOpen }: IdeaCardProps) {
  const isSaved = idea.status === "saved";
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = useCallback(() => {
    onSave();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }, [onSave]);

  return (
    <div className={CARD_BASE}>
      {/* Área clicável para abrir o detalhe */}
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="w-full text-left disabled:cursor-default"
      >
        <div className="p-5 pb-3">
          {/* Formato + território */}
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
              {idea.territory}
            </span>
            {idea.resonanceNote && (
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500"
                title="O que as pessoas mais reconhecem em você"
                aria-label="O que as pessoas mais reconhecem em você"
              />
            )}
            <span className="ml-auto text-[11px] text-zinc-400">{idea.suggestedFormat}</span>
            {onOpen && (
              <span className="text-[13px] text-zinc-300">›</span>
            )}
          </div>

          {/* Título */}
          <h3 className="text-[16px] font-bold tracking-tight text-zinc-950 leading-snug mb-2">
            {idea.title}
          </h3>

          {/* Hook */}
          <p className="text-[13px] italic leading-relaxed text-zinc-500 line-clamp-2">
            &ldquo;{idea.hook}&rdquo;
          </p>
        </div>
      </button>

      {/* Ações */}
      <div className="flex gap-2 px-5 pb-5 pt-1">
        {justSaved ? (
          <span className="flex-1 rounded-full bg-emerald-50 px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-700">
            ✓ Roteiro salvo
          </span>
        ) : isSaved ? (
          <span className="flex-1 rounded-full bg-teal-50 px-3 py-2.5 text-center text-[13px] font-semibold text-teal-700">
            ✓ Na sua lista
          </span>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-full bg-zinc-100 px-3 py-2.5 text-[13px] font-semibold text-zinc-700 transition-colors active:bg-zinc-200"
          >
            Guardar
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full bg-zinc-50 px-4 py-2.5 text-[13px] font-semibold text-zinc-400 transition-colors active:bg-zinc-100"
        >
          Não combina
        </button>
      </div>
    </div>
  );
}

// ─── Direcional block (script points + closing) ──────────────────────────────

function DirecionalBlock({ points, closing }: { points: string[]; closing: string | null }) {
  if (points.length === 0 && !closing) return null;
  return (
    <div className="rounded-xl bg-zinc-50 p-3 mb-3">
      <p className="text-[10px] font-bold uppercase tracking-[1px] text-zinc-400 mb-2">
        O caminho do vídeo
      </p>
      {points.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {points.map((point, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-zinc-700">
              <span className="text-zinc-400">→</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
      {closing && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-500">
          <span className="font-semibold text-zinc-600">Fecha com:</span> {closing}
        </p>
      )}
    </div>
  );
}

// ─── Copy hook button ─────────────────────────────────────────────────────────

function CopyHookButton({ hook }: { hook: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hook);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — silently no-op
    }
  }, [hook]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copiar abertura"
      className="shrink-0 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 active:bg-zinc-200"
    >
      {copied ? (
        "Copiado ✓"
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Copiar abertura
        </>
      )}
    </button>
  );
}
