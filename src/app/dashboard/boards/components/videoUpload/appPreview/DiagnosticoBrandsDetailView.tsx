"use client";

import { useState } from "react";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import type { BrandNarrativeMatchResult } from "@/app/lib/brands/brandNarrativeMatchTypes";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { DiagnosticoDetailEmptyState } from "./DiagnosticoDetailEmptyState";
import { DiagnosticoCommercialReasoningCard } from "./DiagnosticoCommercialReasoningCard";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { refineDiagnosticoSignals } from "./diagnosticoDisplayText";
import { CATEGORY_META } from "./DiagnosticoCategoryMeta";
import { HC, CARD_P } from "./diagnosticoTokens";

interface Props {
  synthesis: CreatorStrategicProfileSynthesis;
  brandMatches?: BrandNarrativeMatchResult[];
  /** True when brand matches were derived from the creator's confirmed map (narrative + territories). */
  brandMapConfirmed?: boolean;
  onNewReading?: () => void;
  onClose: () => void;
}

// ─── Match level badge ────────────────────────────────────────────────────────

const MATCH_LEVEL_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  alto:  { bg: "bg-emerald-50", text: "text-emerald-700", label: "alto fit" },
  medio: { bg: "bg-amber-50",   text: "text-amber-700",   label: "fit médio" },
  baixo: { bg: "bg-zinc-100",   text: "text-zinc-500",    label: "fit baixo" },
};
const MATCH_LEVEL_FALLBACK = { bg: "bg-zinc-100", text: "text-zinc-500", label: "fit" };

// ─── Brand icon placeholder ───────────────────────────────────────────────────

function BrandIconPlaceholder({ name }: { name: string }) {
  const initial = name.trim()[0]?.toUpperCase() ?? "B";
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-[15px] font-bold text-zinc-500">
      {initial}
    </div>
  );
}

// ─── Single brand card (accordion) ───────────────────────────────────────────

function BrandMatchCard({
  match,
  index,
  total,
}: {
  match: BrandNarrativeMatchResult;
  index: number;
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const levelStyle = MATCH_LEVEL_STYLE[match.matchLevel] ?? MATCH_LEVEL_FALLBACK;

  return (
    <li
      className={`py-3 ${index < total - 1 ? "border-b border-zinc-100" : ""}`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <BrandIconPlaceholder name={match.brandName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[15px] font-semibold leading-snug text-zinc-900">
              {match.brandName}
            </p>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${levelStyle.bg} ${levelStyle.text}`}
            >
              {levelStyle.label}
            </span>
          </div>
          {match.category.length > 0 && (
            <p className="mt-0.5 text-[12px] text-zinc-400">
              {match.category.slice(0, 2).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Rationale */}
      {match.rationale && (
        <p className="mt-2 text-[13px] leading-[1.55] text-zinc-600 line-clamp-2">
          {match.rationale}
        </p>
      )}

      {/* Matched signals */}
      {match.matchedSignals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {match.matchedSignals.slice(0, 4).map((signal) => (
            <span
              key={signal}
              className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10.5px] text-zinc-500 ring-1 ring-inset ring-zinc-200"
            >
              {signal}
            </span>
          ))}
        </div>
      )}

      {/* Expandable report */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2.5 flex items-center gap-1 text-[12px] font-semibold text-purple-600"
        aria-expanded={expanded}
      >
        {expanded ? "Fechar relatório" : "Ver como usar"}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path
            d="M2 4.5l4 3 4-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 grid gap-2">
          {/* Como inserir */}
          {match.insertionAngle && (
            <div className="rounded-[12px] bg-zinc-950 px-3.5 py-3 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                Como inserir
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[1.55]">
                {match.insertionAngle}
              </p>
            </div>
          )}

          {/* Formatos sugeridos */}
          {match.suggestedDeliverables && match.suggestedDeliverables.length > 0 && (
            <div className="rounded-[12px] border border-zinc-100 bg-zinc-50 px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                Formatos sugeridos
              </p>
              <ul className="mt-2 grid gap-1.5">
                {match.suggestedDeliverables.slice(0, 4).map((d) => (
                  <li key={d} className="text-[12.5px] leading-[1.5] text-zinc-700">
                    • {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Abordagem sugerida */}
          {match.suggestedApproachMessage && (
            <div className="rounded-[12px] border border-purple-100 bg-purple-50 px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-400">
                Abordagem sugerida
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[1.55] text-purple-900">
                {match.suggestedApproachMessage}
              </p>
            </div>
          )}

          {/* CTA */}
          <a
            href="/campaigns"
            className="flex w-full items-center justify-center rounded-full bg-zinc-950 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(9,9,11,0.35)]"
          >
            Abrir propostas →
          </a>
        </div>
      )}
    </li>
  );
}

// ─── Territories fallback card ────────────────────────────────────────────────

function TerritoriesCard({ synthesis: s }: { synthesis: CreatorStrategicProfileSynthesis }) {
  const territories = refineDiagnosticoSignals(s.commercialTerritories, "commercial");
  if (territories.length === 0) return null;
  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.territory.bg}
          iconSlot={<TerritoryIcon />}
          category="TERRITÓRIOS DE MARCA"
          catColor={HC.territory.text}
        />
        <ul className="flex flex-col">
          {territories.map((t, i) => (
            <li
              key={t.label}
              className={`flex items-start gap-3 py-3 ${
                i < territories.length - 1 ? "border-b border-zinc-50" : ""
              }`}
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-purple-500" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-zinc-900 leading-snug">{t.label}</p>
                {t.summary !== t.label && (
                  <p className="mt-0.5 text-[13px] text-zinc-500 leading-snug">{t.summary}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600">
                {t.evidenceCount} {t.evidenceCount === 1 ? "sinal" : "sinais"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </DiagnosticoCardShell>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function DiagnosticoBrandsDetailView({
  synthesis: s,
  brandMatches = [],
  brandMapConfirmed = false,
  onNewReading,
  onClose,
}: Props) {
  const meta = CATEGORY_META.brands;
  const hasBrandMatches = brandMatches.length > 0;
  const hasAnything = hasBrandMatches || s.commercialTerritories.length > 0 || s.commercialReasoning.length > 0;

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
    >
      {!hasAnything ? (
        <div className="mx-4 mt-2 rounded-[20px] border border-purple-100 bg-purple-50 px-5 py-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
                stroke="#a855f7"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-zinc-900">Aguardando territórios comerciais</p>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-zinc-500">
            Marcas com fit aparecem depois que você confirma seus territórios. Analise vídeos que mostrem rotina, produto em uso ou lifestyle com contexto — esses sinais ativam o match.
          </p>
        </div>
      ) : (
        <>
          {/* ── Matched brands section ── */}
          {hasBrandMatches && (
            <DiagnosticoCardShell>
              <div className={CARD_P}>
                <DiagCardHeader
                  iconBg="bg-purple-500"
                  iconSlot={<BrandMatchIcon />}
                  category="MARCAS COM FIT NARRATIVO"
                  catColor="text-purple-600"
                />

                {/* Confirmed-map badge — shown when matches derive from creator's own confirmed map */}
                {brandMapConfirmed && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 self-start w-fit">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" stroke="#9333ea" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[11px] font-semibold text-purple-700">
                      Baseado no seu mapa confirmado
                    </span>
                  </div>
                )}

                <ul className="flex flex-col">
                  {brandMatches.map((match, i) => (
                    <BrandMatchCard
                      key={match.brandId}
                      match={match}
                      index={i}
                      total={brandMatches.length}
                    />
                  ))}
                </ul>
                <p className="mt-3 text-[10.5px] leading-[1.5] text-zinc-400">
                  {brandMapConfirmed
                    ? "Derivado da narrativa e territórios que você confirmou — use como direção para conversas comerciais."
                    : "Fit narrativo em formação — use como direção para conversas comerciais, sem tratar como oportunidade fechada."}
                </p>
              </div>
            </DiagnosticoCardShell>
          )}

          {/* ── Territories (secondary context) ── */}
          {s.commercialTerritories.length > 0 && (
            <TerritoriesCard synthesis={s} />
          )}

          {/* ── Commercial reasoning ── */}
          <DiagnosticoCommercialReasoningCard reasoning={s.commercialReasoning} />
        </>
      )}
    </DiagnosticoCategoryDetailView>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TerritoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <line x1="7" y1="7" x2="7.01" y2="7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function BrandMatchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M7 7.01L7.01 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
