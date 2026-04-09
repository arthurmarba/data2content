"use client";

import dynamic from "next/dynamic";
import React from "react";
import { ArrowLeft, Save, Trash2, Sparkles, Undo2, Redo2, Check, Lock } from "lucide-react";
import type { InlineAnnotation } from "./InlineScriptEditor";

const InlineScriptEditor = dynamic(
  () => import("./InlineScriptEditor").then((mod) => mod.InlineScriptEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-full min-h-[280px] w-full animate-pulse rounded-[1.1rem] border border-zinc-100/80 bg-zinc-50/80"
        aria-hidden="true"
      />
    ),
  }
);

type ScriptPublication = {
  isPosted: boolean;
  postedAt?: string | null;
  content?: {
    id: string;
    caption?: string | null;
    postDate?: string | null;
    postLink?: string | null;
    type?: string | null;
    coverUrl?: string | null;
    engagement?: number | null;
    totalInteractions?: number | null;
  } | null;
};

type CampaignOption = {
  id: string;
  campaignTitle: string;
  brandName: string;
};

type ContentOption = {
  id: string;
  caption: string;
  postDate: string | null;
  postLink: string | null;
  type: string | null;
  coverUrl: string | null;
  engagement: number | null;
  totalInteractions: number | null;
};

type EditorState = {
  id: string | null;
  title: string;
  content: string;
  recommendation?: {
    isRecommended: boolean;
    recommendedByAdminName?: string | null;
    recommendedAt?: string | null;
  } | null;
  adminAnnotation?: {
    notes?: string | null;
    updatedByName?: string | null;
    updatedAt?: string | null;
  } | null;
  adminAnnotationDraft: string;
  inlineAnnotations: InlineAnnotation[];
  isPosted: boolean;
  postedContentId: string;
  publication: ScriptPublication | null;
  aiPrompt: string;
  saving: boolean;
  saved: boolean;
  deleting: boolean;
  adjusting: boolean;
  error: string | null;
};

type MyScriptsEditorSurfaceProps = {
  compactView: boolean;
  editor: EditorState;
  viewerName: string;
  requestedProposalId: string | null;
  isAdminViewer: boolean;
  isAuthenticated: boolean;
  canInteract: boolean;
  campaignOptionsReady: boolean;
  campaignsLoading: boolean;
  linkingToCampaign: boolean;
  campaignOptions: CampaignOption[];
  selectedCampaignId: string;
  canUndo: boolean;
  canRedo: boolean;
  activeInlineAnnotationId: string | null;
  contentOptionsReady: boolean;
  contentOptions: ContentOption[];
  contentOptionsLoading: boolean;
  selectedPostedContentMissing: boolean;
  selectedPostedContentOption: ContentOption | null;
  onBack: () => void;
  onReturnToCampaign: () => void;
  onSelectedCampaignIdChange: (value: string) => void;
  onRequestGoogleLogin: () => void;
  onOpenPremiumLinkingPaywall: (source: string) => void;
  onCampaignOptionsInteraction: () => void;
  onLinkToCampaign: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onDelete: () => void;
  onTitleChange: (value: string) => void;
  onDraftKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onContentChange: (value: string) => void;
  onInlineAnnotationsChange: (annotations: InlineAnnotation[]) => void;
  onInlineAnnotationFocus: (id: string | null) => void;
  onResolveAnnotation: (id: string) => void;
  onAdminAnnotationDraftChange: (value: string) => void;
  onPostedToggle: (checked: boolean) => void;
  onPostedContentInteraction: () => void;
  onPostedContentIdChange: (value: string) => void;
  onAiPromptChange: (value: string) => void;
  onAiPromptKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onAiAdjust: () => void;
  ensureInstagramConnectedForLinking: (source: string) => boolean;
  formatDate: (value: string) => string;
  formatNumber: (value: number | null | undefined) => string;
  getPostedContentLabel: (publication: ScriptPublication | null) => string;
  buildContentOptionLabel: (option: ContentOption) => string;
};

type CompactEditorSummaryItem = {
  key: "recommendation" | "admin-feedback" | "revisions";
  tone: "amber" | "rose" | "sky";
  title: string;
  description: string;
};

export function MyScriptsEditorSurface({
  compactView,
  editor,
  viewerName,
  requestedProposalId,
  isAdminViewer,
  isAuthenticated,
  canInteract,
  campaignOptionsReady,
  campaignsLoading,
  linkingToCampaign,
  campaignOptions,
  selectedCampaignId,
  canUndo,
  canRedo,
  activeInlineAnnotationId,
  contentOptionsReady,
  contentOptions,
  contentOptionsLoading,
  selectedPostedContentMissing,
  selectedPostedContentOption,
  onBack,
  onReturnToCampaign,
  onSelectedCampaignIdChange,
  onRequestGoogleLogin,
  onOpenPremiumLinkingPaywall,
  onCampaignOptionsInteraction,
  onLinkToCampaign,
  onUndo,
  onRedo,
  onSave,
  onDelete,
  onTitleChange,
  onDraftKeyDown,
  onContentChange,
  onInlineAnnotationsChange,
  onInlineAnnotationFocus,
  onResolveAnnotation,
  onAdminAnnotationDraftChange,
  onPostedToggle,
  onPostedContentInteraction,
  onPostedContentIdChange,
  onAiPromptChange,
  onAiPromptKeyDown,
  onAiAdjust,
  ensureInstagramConnectedForLinking,
  formatDate,
  formatNumber,
  getPostedContentLabel,
  buildContentOptionLabel,
}: MyScriptsEditorSurfaceProps) {
  const compactEditorSummaryItems: CompactEditorSummaryItem[] = compactView
    ? [
        editor.recommendation?.isRecommended
          ? {
              key: "recommendation",
              tone: "amber",
              title: "Recomendacao",
              description: editor.recommendation.recommendedByAdminName
                ? `Sinalizada por ${editor.recommendation.recommendedByAdminName}`
                : "Sinalizada pelo time",
            }
          : null,
        editor.adminAnnotation?.notes?.trim()
          ? {
              key: "admin-feedback",
              tone: "rose",
              title: "Feedback do admin",
              description: editor.adminAnnotation.notes.trim(),
            }
          : null,
        editor.inlineAnnotations.length > 0
          ? {
              key: "revisions",
              tone: "sky",
              title: "Revisoes",
              description:
                editor.inlineAnnotations.length === 1
                  ? "1 comentario no texto"
                  : `${editor.inlineAnnotations.length} comentarios no texto`,
            }
          : null,
      ].filter((item): item is CompactEditorSummaryItem => item !== null)
    : [];

  return (
    <div className={`flex min-h-0 flex-col bg-transparent [-webkit-tap-highlight-color:transparent] ${compactView ? "h-full overflow-hidden" : "h-full overflow-hidden"}`}>
      <header className="shrink-0 border-b border-zinc-100/90 bg-transparent">
        <div className={`mx-auto w-full ${compactView ? "px-3.5 py-2.5" : "max-w-[860px] px-4 py-3 sm:px-6 sm:py-4"}`}>
          <div className={`flex flex-col ${compactView ? "gap-2.5" : "gap-3"}`}>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100/80"
                aria-label="Voltar para Meus Roteiros"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <p className={`mb-0.5 font-medium uppercase tracking-[0.08em] text-slate-400 ${compactView ? "text-[9px]" : "text-[11px]"}`}>
                  Meu roteiro
                </p>
                <input
                  type="text"
                  value={editor.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  onKeyDown={onDraftKeyDown}
                  placeholder="Roteiro sem titulo"
                  className={`min-w-0 w-full border-0 bg-transparent p-0 font-semibold leading-tight text-slate-900 outline-none ring-0 ring-transparent placeholder:text-slate-300 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 ${compactView ? "text-[16px]" : "text-lg sm:text-[1.65rem]"}`}
                />
              </div>
            </div>

            <div className={`flex w-full flex-wrap gap-2 border-t border-zinc-100/90 ${compactView ? "items-stretch pt-2.5" : "items-center pt-3"}`}>
              {requestedProposalId ? (
                <button
                  type="button"
                  onClick={onReturnToCampaign}
                  className={`inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/84 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-white ${compactView ? "w-full justify-center" : ""}`}
                >
                  Voltar para campanha
                </button>
              ) : null}
              {!isAdminViewer ? (
                <div className={`flex items-center gap-1.5 ${compactView ? "w-full" : "min-w-0 flex-1 sm:flex-none"}`}>
                  {campaignOptionsReady ? (
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => onSelectedCampaignIdChange(e.target.value)}
                      disabled={campaignsLoading || linkingToCampaign || campaignOptions.length === 0}
                      className={`rounded-xl border border-zinc-200 bg-zinc-50/84 px-2.5 py-1.5 text-sm text-zinc-700 outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100 ${compactView ? "flex-1" : "min-w-[190px]"}`}
                    >
                      {campaignsLoading ? (
                        <option value="">Carregando...</option>
                      ) : campaignOptions.length === 0 ? (
                        <option value="">Sem campanhas</option>
                      ) : (
                        campaignOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.campaignTitle}
                          </option>
                        ))
                      )}
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={onCampaignOptionsInteraction}
                      disabled={campaignsLoading}
                      className={`rounded-xl border border-zinc-200 bg-zinc-50/84 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-100 ${compactView ? "flex-1" : "min-w-[120px]"}`}
                    >
                      {campaignsLoading ? "..." : "Carregar campanhas"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!campaignOptionsReady) {
                        onCampaignOptionsInteraction();
                        return;
                      }
                      if (!isAuthenticated) {
                        onRequestGoogleLogin();
                        return;
                      }
                      if (!canInteract) {
                        onOpenPremiumLinkingPaywall("scripts_editor_link_btn");
                        return;
                      }
                      onLinkToCampaign();
                    }}
                    disabled={linkingToCampaign || campaignsLoading || !campaignOptionsReady || !selectedCampaignId || !editor.id}
                    title="Vincular a campanha"
                    className={`inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50/84 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-white disabled:opacity-60 ${compactView ? "shrink-0" : ""}`}
                  >
                    <Check size={14} className={linkingToCampaign ? "animate-pulse" : ""} />
                    {!compactView && (linkingToCampaign ? "Vinculando..." : "Vincular")}
                  </button>
                </div>
              ) : null}
              <div className={`flex gap-1.5 ${compactView ? "w-full" : ""}`}>
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={`inline-flex h-8.5 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50/84 text-zinc-700 transition hover:border-zinc-300 hover:bg-white disabled:opacity-40 ${compactView ? "flex-1" : "w-8.5"}`}
                  aria-label="Desfazer edicao"
                >
                  <Undo2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className={`inline-flex h-8.5 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50/84 text-zinc-700 transition hover:border-zinc-300 hover:bg-white disabled:opacity-40 ${compactView ? "flex-1" : "w-8.5"}`}
                  aria-label="Refazer edicao"
                >
                  <Redo2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={editor.saving}
                  className={`inline-flex h-8.5 items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition disabled:opacity-60 ${compactView ? "flex-[1.5]" : ""} ${editor.saved
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-zinc-200 bg-zinc-50/84 text-zinc-800 hover:border-zinc-300 hover:bg-white"
                    }`}
                >
                  <Save size={14} />
                  {editor.saving ? "..." : editor.saved ? "Salvo" : "Salvar"}
                </button>
                {editor.id ? (
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={editor.deleting}
                    className={`inline-flex h-8.5 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white/88 px-3 py-1.5 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 ${compactView ? "flex-[1.2]" : ""}`}
                  >
                    <Trash2 size={14} />
                    {editor.deleting ? "..." : "Excluir"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`${compactView ? "flex min-h-0 flex-1 px-3.5 pb-3 pt-2" : "relative flex h-full min-h-0 flex-1 gap-4 py-2"}`}>
        <div className={`mx-auto flex w-full flex-col rounded-[1.4rem] border border-zinc-100/90 ${compactView ? "h-full min-h-0 overflow-hidden bg-white px-3.5 pt-2.5" : "h-full overflow-hidden max-w-[860px] rounded-[1.7rem] bg-white/72 px-4 backdrop-blur-xl sm:px-6"}`}>
          {compactView && compactEditorSummaryItems.length > 0 ? (
            <div className="dashboard-scrollbar-hidden shrink-0 flex items-center gap-2 border-b border-zinc-100/90 pb-2.5 overflow-x-auto">
              {compactEditorSummaryItems.map((item) => {
                const toneClasses =
                  item.tone === "amber"
                    ? "bg-amber-50 text-amber-700 ring-amber-100/90"
                    : item.tone === "rose"
                      ? "bg-rose-50 text-rose-600 ring-rose-100/90"
                      : "bg-sky-50 text-sky-600 ring-sky-100/90";
                return (
                  <div key={item.key} className="flex min-w-[140px] max-w-[180px] items-center gap-2 rounded-xl border border-zinc-100/90 bg-zinc-50/42 px-2.5 py-1.5 transition-colors hover:bg-zinc-50/64">
                    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1 ${toneClasses}`}>
                      {item.key === "revisions" ? (
                        <span className="text-[9px] font-bold">{editor.inlineAnnotations.length}</span>
                      ) : (
                        <Sparkles size={11} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 leading-none">{item.title}</p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-600 leading-tight">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {!compactView && editor.recommendation?.isRecommended ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 sm:text-sm">
              Recomendacao especial
              {editor.recommendation.recommendedByAdminName
                ? ` de ${editor.recommendation.recommendedByAdminName}`
                : " do time"}{" "}
              {editor.recommendation.recommendedAt
                ? `(${formatDate(editor.recommendation.recommendedAt)})`
                : ""}.
            </div>
          ) : null}
          {!compactView && editor.adminAnnotation?.notes?.trim() ? (
            <div className="mt-3 rounded-xl border border-[#FFDEE9] bg-[#FFF6F9] px-3 py-2 text-xs text-slate-700 sm:text-sm">
              <p className="font-semibold text-slate-800">Feedback do admin</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{editor.adminAnnotation.notes}</p>
              {editor.adminAnnotation.updatedAt ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                </p>
              ) : null}
            </div>
          ) : null}
          {!compactView && editor.inlineAnnotations.length > 0 ? (
            <div className="mt-3 rounded-xl border border-zinc-100/90 bg-zinc-50/76 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Revisoes no texto ({editor.inlineAnnotations.length})
                </p>
                {activeInlineAnnotationId ? (
                  <button
                    type="button"
                    onClick={() => onInlineAnnotationFocus(null)}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                  >
                    Limpar foco
                  </button>
                ) : null}
              </div>
              <div className="space-y-2">
                {editor.inlineAnnotations.map((ann) => {
                  const isActive = ann.id === activeInlineAnnotationId;
                  return (
                    <div
                      key={ann.id}
                      className={`rounded-xl border px-3 py-2.5 transition ${
                        ann.isOrphaned
                          ? "border-slate-200 bg-white opacity-70"
                          : isActive
                            ? "border-amber-300 bg-amber-50"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-700">
                            {ann.authorName}
                            {ann.resolved ? " · Resolvida" : ann.isOrphaned ? " · Trecho nao encontrado" : ""}
                          </p>
                          <p className="mt-1 line-clamp-2 border-l-2 border-slate-200 pl-2 text-[11px] italic text-slate-500">
                            &quot;{ann.quote}&quot;
                          </p>
                          <p className="mt-1 text-sm text-slate-800">{ann.comment}</p>
                        </div>
                        {!ann.isOrphaned ? (
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onInlineAnnotationFocus(ann.id)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Ver no texto
                            </button>
                            {isAdminViewer && !ann.resolved ? (
                              <button
                                type="button"
                                onClick={() => onResolveAnnotation(ann.id)}
                                className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-600 hover:bg-slate-300"
                              >
                                Resolver
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div
            className={`relative ${
              compactView
                ? "mt-2.5 min-h-0 flex-1 overflow-hidden rounded-[1.15rem] border border-zinc-100/90 bg-zinc-50/36 px-3"
                : "min-h-0 flex-1"
            }`}
          >
            <InlineScriptEditor
              content={editor.content}
              onChangeContent={onContentChange}
              annotations={editor.inlineAnnotations}
              onAnnotationsChange={onInlineAnnotationsChange}
              activeAnnotationId={activeInlineAnnotationId}
              onAnnotationFocus={onInlineAnnotationFocus}
              onKeyDown={onDraftKeyDown}
              isAdminViewer={isAdminViewer}
              viewerName={viewerName}
              placeholder="Escreva seu roteiro aqui..."
              compactView={compactView}
            />
          </div>

          {isAdminViewer ? (
            <div className={`shrink-0 border-t border-slate-100 ${compactView ? "py-2" : "py-4"}`}>
              {compactView ? (
                <div className="rounded-[1.05rem] border border-zinc-100/70 bg-zinc-50/52 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-zinc-50 text-zinc-500 ring-1 ring-zinc-100/90">
                      <Check size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="dashboard-type-section-title text-zinc-950">Feedback para creator</p>
                      {editor.adminAnnotation?.updatedAt ? (
                        <p className="dashboard-type-meta mt-1 text-zinc-400">
                          {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <textarea
                    value={editor.adminAnnotationDraft}
                    onChange={(e) => onAdminAnnotationDraftChange(e.target.value)}
                    placeholder="Esse feedback aparece para o dono do roteiro."
                    className="mt-2.5 h-14 w-full resize-none rounded-[0.95rem] border border-zinc-100/90 bg-white px-3 py-2 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-zinc-200 focus:bg-white"
                  />
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500">Feedback para creator (admin)</p>
                    {editor.adminAnnotation?.updatedAt ? (
                      <p className="text-[11px] text-slate-400">
                        {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                      </p>
                    ) : null}
                  </div>
                  <textarea
                    value={editor.adminAnnotationDraft}
                    onChange={(e) => onAdminAnnotationDraftChange(e.target.value)}
                    placeholder="Esse feedback aparece para o dono do roteiro."
                    className="h-24 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                  />
                </>
              )}
            </div>
          ) : null}

          <div className={`shrink-0 border-t border-slate-100 ${compactView ? "py-2" : "py-4"}`}>
            <div className={compactView ? "rounded-[1.05rem] border border-zinc-100/70 bg-zinc-50/52 px-3 py-2.5" : "rounded-xl border border-slate-200 bg-slate-50/70 p-3"}>
              <label className={`flex cursor-pointer items-center gap-2 font-semibold ${compactView ? "text-xs text-zinc-800" : "text-sm text-slate-800"}`}>
                <input
                  type="checkbox"
                  checked={editor.isPosted}
                  onChange={(event) => {
                    if (!isAuthenticated) {
                      onRequestGoogleLogin();
                      return;
                    }
                    if (!canInteract) {
                      onOpenPremiumLinkingPaywall("scripts_link_posted_checkbox");
                      return;
                    }
                    if (!ensureInstagramConnectedForLinking("scripts_link_posted_checkbox")) {
                      return;
                    }
                    onPostedToggle(event.target.checked);
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                Marcar como postado
                {!canInteract ? <Lock className="ml-1 h-3 w-3 text-amber-500" /> : null}
              </label>
              {!compactView && (
                <p className="mt-1 text-xs text-slate-500">
                  Ao marcar, selecione o conteudo publicado para correlacionar o engajamento.
                </p>
              )}

              {editor.isPosted ? (
                <div className="mt-3 space-y-2">
                  {contentOptionsReady ? (
                    <select
                      value={editor.postedContentId}
                      onChange={(event) => onPostedContentIdChange(event.target.value)}
                      disabled={contentOptionsLoading || contentOptions.length === 0}
                      className={`w-full border bg-white px-3 py-2 text-sm outline-none transition disabled:cursor-not-allowed ${compactView ? "rounded-[0.95rem] border-zinc-200 text-zinc-700 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-100" : "rounded-lg border-slate-200 text-slate-700 focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"}`}
                    >
                      {contentOptionsLoading ? (
                        <option value="">Carregando conteudos...</option>
                      ) : (
                        <option value="">
                          {contentOptions.length === 0
                            ? "Nenhum conteudo disponivel"
                            : "Selecione o conteudo publicado"}
                        </option>
                      )}
                      {selectedPostedContentMissing ? (
                        <option value={editor.postedContentId}>
                          {getPostedContentLabel(editor.publication)} (vinculo atual)
                        </option>
                      ) : null}
                      {contentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {buildContentOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={onPostedContentInteraction}
                      disabled={contentOptionsLoading}
                      className={`w-full border bg-white px-3 py-2 text-sm font-semibold text-zinc-700 outline-none transition disabled:cursor-not-allowed ${compactView ? "rounded-[0.95rem] border-zinc-200 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-100" : "rounded-lg border-slate-200 focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"}`}
                    >
                      {contentOptionsLoading ? "Carregando conteudos..." : "Carregar conteudos publicados"}
                    </button>
                  )}

                  {selectedPostedContentOption || selectedPostedContentMissing ? (
                    <div className={`px-3 py-2 ${compactView ? "rounded-[0.95rem] border border-emerald-200 bg-emerald-50 text-[11px] leading-5 text-emerald-900" : "rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-900"}`}>
                      <p className="font-semibold">
                        {selectedPostedContentOption?.caption || getPostedContentLabel(editor.publication)}
                      </p>
                      <p className="mt-1">
                        Postado em{" "}
                        {selectedPostedContentOption?.postDate
                          ? formatDate(selectedPostedContentOption.postDate)
                          : editor.publication?.content?.postDate
                            ? formatDate(editor.publication.content.postDate)
                            : "-"}{" "}
                        · Interacoes{" "}
                        {formatNumber(
                          selectedPostedContentOption?.totalInteractions ??
                          editor.publication?.content?.totalInteractions ??
                          null
                        )}{" "}
                        · Engajamento{" "}
                        {typeof (selectedPostedContentOption?.engagement ??
                          editor.publication?.content?.engagement) === "number"
                          ? `${(selectedPostedContentOption?.engagement ??
                            editor.publication?.content?.engagement ??
                            0).toFixed(2)}`
                          : "-"}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className={`shrink-0 border-t border-zinc-100/90 ${compactView ? "py-2" : "py-4"}`}>
            <div
              className={!canInteract ? "cursor-pointer group relative" : ""}
              onClick={() => {
                if (!isAuthenticated) {
                  onRequestGoogleLogin();
                  return;
                }
                if (!canInteract) {
                  onOpenPremiumLinkingPaywall("scripts_ai_assistant_click");
                }
              }}
            >
              {!canInteract ? (
                <div className="absolute inset-0 z-10 flex items-center justify-end pr-4 pointer-events-none">
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200/50">
                    <Lock size={10} />
                    PRO
                  </div>
                </div>
              ) : null}
              <div className={!canInteract ? "opacity-60 grayscale-[0.5] pointer-events-none" : ""}>
                {compactView ? (
                  <div className="flex items-center gap-2 rounded-[0.95rem] border border-zinc-100/70 bg-zinc-50/52 px-2 py-1.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/90">
                      <Sparkles size={14} />
                    </span>
                    <input
                      type="text"
                      value={editor.aiPrompt}
                      onChange={(e) => onAiPromptChange(e.target.value)}
                      onKeyDown={onAiPromptKeyDown}
                      placeholder="Ajuste com IA..."
                      className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-[13px] text-zinc-800 outline-none ring-0 ring-transparent placeholder:text-zinc-400 focus:outline-none focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={onAiAdjust}
                      disabled={editor.adjusting}
                      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-60"
                    >
                      {editor.adjusting ? "..." : "Enviar"}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-xs font-medium text-slate-500">Assistente IA</p>
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-100/90 bg-zinc-50/76 p-2">
                      <input
                        type="text"
                        value={editor.aiPrompt}
                        onChange={(e) => onAiPromptChange(e.target.value)}
                        onKeyDown={onAiPromptKeyDown}
                        placeholder="Peca um roteiro novo ou ajuste no roteiro atual..."
                        className="flex-1 border-0 bg-transparent px-2 py-2 text-sm text-zinc-800 outline-none ring-0 ring-transparent placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                      />
                      <button
                        type="button"
                        onClick={onAiAdjust}
                        disabled={editor.adjusting}
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
                      >
                        <Sparkles size={14} />
                        {editor.adjusting ? "Processando..." : "Enviar"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {editor.error ? <p className="shrink-0 pb-4 text-sm text-rose-600">{editor.error}</p> : null}
        </div>
      </main>
    </div>
  );
}
