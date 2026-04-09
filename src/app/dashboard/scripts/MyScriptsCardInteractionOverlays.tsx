"use client";

import React from "react";
import { Check } from "lucide-react";

type ScriptLinkingCampaignSummary = {
  proposalId: string;
  linkId: string;
  campaignTitle: string;
  brandName: string;
  linkedAt: string | null;
};

type ScriptLinkingSummary = {
  isLinked: boolean;
  totalLinks: number;
  campaigns: ScriptLinkingCampaignSummary[];
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
  engagement: number | null;
  totalInteractions: number | null;
};

type QuickPublishScript = {
  updatedAt: string;
};

export function MyScriptsCardLinkPopover({
  cardLinkPopoverRef,
  linkingSummary,
  linkedCampaigns,
  selectedCardCampaignId,
  onCardCampaignChange,
  campaignsLoading,
  isCardLinking,
  campaignOptions,
  cardLinkError,
  onCloseCardLinkPanel,
  isSelectedCampaignAlreadyLinked,
  onCardUnlinkConfirm,
  onCardLinkConfirm,
}: {
  cardLinkPopoverRef: React.MutableRefObject<HTMLDivElement | null>;
  linkingSummary: ScriptLinkingSummary;
  linkedCampaigns: ScriptLinkingCampaignSummary[];
  selectedCardCampaignId: string;
  onCardCampaignChange: (value: string) => void;
  campaignsLoading: boolean;
  isCardLinking: boolean;
  campaignOptions: CampaignOption[];
  cardLinkError?: string | null;
  onCloseCardLinkPanel: () => void;
  isSelectedCampaignAlreadyLinked: boolean;
  onCardUnlinkConfirm: () => void | Promise<void>;
  onCardLinkConfirm: () => void | Promise<void>;
}) {
  return (
    <div
      ref={cardLinkPopoverRef}
      className="absolute inset-x-2 bottom-[4.9rem] z-20 rounded-[1.2rem] border border-zinc-100/90 bg-white/90 p-3 shadow-[0_16px_34px_rgba(15,23,42,0.08)] backdrop-blur-xl"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {linkingSummary.isLinked ? "Gerenciar vínculo" : "Vincular roteiro"}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Conecte este roteiro a uma campanha para acompanhar status e contexto.
      </p>
      {linkingSummary.isLinked ? (
        <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50 p-2">
          <p className="text-[11px] font-semibold text-emerald-700">
            {linkingSummary.totalLinks > 1
              ? `${linkingSummary.totalLinks} campanhas vinculadas`
              : "Campanha vinculada"}
          </p>
          {linkedCampaigns.slice(0, 2).map((campaign) => (
            <p key={campaign.linkId} className="line-clamp-1 text-[11px] text-emerald-800">
              {campaign.campaignTitle} · {campaign.brandName}
            </p>
          ))}
        </div>
      ) : null}
      <select
        value={selectedCardCampaignId}
        onChange={(event) => onCardCampaignChange(event.target.value)}
        disabled={campaignsLoading || isCardLinking || campaignOptions.length === 0}
        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        {campaignsLoading ? (
          <option value="">Carregando campanhas...</option>
        ) : campaignOptions.length === 0 ? (
          <option value="">Sem campanhas disponíveis</option>
        ) : (
          campaignOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.campaignTitle} · {option.brandName}
            </option>
          ))
        )}
      </select>
      {cardLinkError ? (
        <p className="mt-2 text-[11px] font-medium text-rose-600">{cardLinkError}</p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCloseCardLinkPanel}
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          disabled={isCardLinking}
        >
          Fechar
        </button>
        <button
          type="button"
          onClick={() => {
            if (isSelectedCampaignAlreadyLinked) {
              void onCardUnlinkConfirm();
              return;
            }
            void onCardLinkConfirm();
          }}
          disabled={isCardLinking || campaignsLoading || !selectedCardCampaignId}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
            isSelectedCampaignAlreadyLinked ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          {isCardLinking
            ? "Processando..."
            : isSelectedCampaignAlreadyLinked
              ? "Desvincular"
              : linkingSummary.isLinked
                ? "Adicionar vínculo"
                : "Vincular"}
        </button>
      </div>
    </div>
  );
}

export function MyScriptsQuickPublishOverlay({
  compactView,
  quickPublishPopoverRef,
  script,
  quickPublishQuery,
  onQuickPublishQueryChange,
  quickPublishSaving,
  contentOptionsLoading,
  filteredQuickPublishOptions,
  quickPublishContentId,
  onQuickPublishContentChange,
  formatDateCompact,
  formatNumber,
  selectedQuickPublishOption,
  onCloseQuickPublish,
  onConfirmQuickPublish,
  formatDate,
}: {
  compactView: boolean;
  quickPublishPopoverRef: React.MutableRefObject<HTMLDivElement | null>;
  script: QuickPublishScript;
  quickPublishQuery: string;
  onQuickPublishQueryChange: (value: string) => void;
  quickPublishSaving: boolean;
  contentOptionsLoading: boolean;
  filteredQuickPublishOptions: ContentOption[];
  quickPublishContentId: string;
  onQuickPublishContentChange: (contentId: string) => void;
  formatDateCompact: (value: string) => string;
  formatNumber: (value: number | null | undefined) => string;
  selectedQuickPublishOption: ContentOption | null;
  onCloseQuickPublish: () => void;
  onConfirmQuickPublish: () => void | Promise<void>;
  formatDate: (value: string) => string;
}) {
  if (!compactView) {
    return (
      <div
        ref={quickPublishPopoverRef}
        className="absolute inset-x-2 bottom-[4.9rem] z-20 rounded-[1.2rem] border border-white/90 bg-white/92 p-3 shadow-[0_26px_54px_rgba(15,23,42,0.16)] backdrop-blur-xl"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conteúdo publicado</p>
        <input
          type="text"
          value={quickPublishQuery}
          onChange={(event) => onQuickPublishQueryChange(event.target.value)}
          placeholder="Buscar legenda ou tipo..."
          disabled={quickPublishSaving}
          className="mt-2 w-full rounded-md border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"
        />
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-1.5">
          {contentOptionsLoading ? (
            <p className="px-2 py-2 text-xs text-slate-500">Carregando conteúdos...</p>
          ) : filteredQuickPublishOptions.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-500">Nenhum conteúdo encontrado.</p>
          ) : (
            filteredQuickPublishOptions.slice(0, 20).map((option) => {
              const selected = quickPublishContentId === option.id;
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => onQuickPublishContentChange(option.id)}
                  disabled={quickPublishSaving}
                  className={`w-full rounded-md border bg-white px-2 py-2 text-left text-xs transition ${
                    selected ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <p className="line-clamp-2 font-semibold text-slate-700">{option.caption}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {option.postDate ? formatDateCompact(option.postDate) : "Sem data"} · Eng{" "}
                    {typeof option.engagement === "number" ? option.engagement.toFixed(2) : "-"} · Interações{" "}
                    {formatNumber(option.totalInteractions)}
                  </p>
                </button>
              );
            })
          )}
        </div>
        {selectedQuickPublishOption ? (
          <p className="mt-2 line-clamp-1 text-[11px] text-emerald-700">
            Selecionado: {selectedQuickPublishOption.caption}
          </p>
        ) : null}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCloseQuickPublish}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            disabled={quickPublishSaving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirmQuickPublish();
            }}
            disabled={quickPublishSaving || !quickPublishContentId}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Check size={12} />
            {quickPublishSaving ? "Salvando..." : "Marcar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(244,244,245,0.68)] px-3 py-3 backdrop-blur-[2px]">
      <div
        ref={quickPublishPopoverRef}
        className="flex max-h-[min(620px,calc(100vh-4rem))] w-full max-w-[390px] min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-zinc-100/90 bg-white shadow-[0_28px_64px_rgba(15,23,42,0.16)]"
      >
        <div className="shrink-0 border-b border-zinc-100/90 px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="dashboard-type-section-title text-zinc-950">Conteúdo publicado</p>
              <p className="dashboard-type-meta mt-1 text-zinc-500">
                Escolha o post para vincular ao roteiro.
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseQuickPublish}
              className="dashboard-type-control inline-flex shrink-0 items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-600 hover:bg-zinc-50"
              disabled={quickPublishSaving}
            >
              Fechar
            </button>
          </div>

          <input
            type="text"
            value={quickPublishQuery}
            onChange={(event) => onQuickPublishQueryChange(event.target.value)}
            placeholder="Buscar legenda ou tipo..."
            disabled={quickPublishSaving}
            className="mt-3 w-full rounded-[0.95rem] border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-700 outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-100"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          <div className="space-y-1.5 rounded-[1rem] border border-zinc-100/90 bg-zinc-50/56 p-1.5">
            {contentOptionsLoading ? (
              <p className="px-2 py-2 text-xs text-zinc-500">Carregando conteúdos...</p>
            ) : filteredQuickPublishOptions.length === 0 ? (
              <p className="px-2 py-2 text-xs text-zinc-500">Nenhum conteúdo encontrado.</p>
            ) : (
              filteredQuickPublishOptions.slice(0, 20).map((option) => {
                const selected = quickPublishContentId === option.id;
                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => onQuickPublishContentChange(option.id)}
                    disabled={quickPublishSaving}
                    className={`w-full rounded-[0.9rem] border bg-white px-2.5 py-2.5 text-left text-xs transition ${
                      selected ? "border-emerald-200 ring-2 ring-emerald-100" : "border-zinc-100 hover:border-zinc-200"
                    }`}
                  >
                    <p className="line-clamp-2 font-semibold leading-snug text-zinc-800">{option.caption}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {option.postDate ? formatDateCompact(option.postDate) : "Sem data"} · Eng{" "}
                      {typeof option.engagement === "number" ? option.engagement.toFixed(2) : "-"} · Interações{" "}
                      {formatNumber(option.totalInteractions)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-100/90 bg-white px-3.5 py-3">
          <p className="dashboard-type-meta line-clamp-1 text-zinc-400">
            Atualizado em {formatDate(script.updatedAt)}
          </p>
          {selectedQuickPublishOption ? (
            <p className="dashboard-type-meta mt-1 line-clamp-1 text-emerald-700">
              Selecionado: {selectedQuickPublishOption.caption}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCloseQuickPublish}
              className="rounded-[0.9rem] border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              disabled={quickPublishSaving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                void onConfirmQuickPublish();
              }}
              disabled={quickPublishSaving || !quickPublishContentId}
              className="inline-flex items-center gap-1 rounded-[0.9rem] bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              <Check size={12} />
              {quickPublishSaving ? "Salvando..." : "Marcar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
