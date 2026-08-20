"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { patternActionOf } from "@/app/lib/creatorWeeklyReport/patternActions";
import type { PatternHighlight } from "@/app/lib/creatorWeeklyReport/patternHighlights";
import type {
  PatternContext,
  PatternTerritoryRow,
} from "@/app/lib/creatorWeeklyReport/patternContextTypes";
import {
  buildPatternVerdict,
  formatVerdictIndex,
  VERDICT_DIMENSION,
} from "@/app/lib/creatorWeeklyReport/patternVerdict";
import type { CreatorWeeklyReportDetail } from "@/app/lib/creatorWeeklyReport/types";

import { ProfileTrendBars, describeTrend } from "./ProfileTrendBars";
import { trendSeriesOf } from "./ProfilePatternSections";
import type { TerritoryTrendPost } from "./ProfileTerritoryTrends";

/**
 * O detalhe de um padrão — a tela que responde "e daí?".
 *
 * Era uma lista de três linhas que abria dentro do card. Servia para ver o
 * ranking e parava aí; a pergunta seguinte, que é a que decide, ficava sem
 * resposta: **esse número é meu ou é do assunto?** Alguém que descobre "natureza
 * 7,5×" precisa saber se isso é uma descoberta pessoal ou se todo mundo que fala
 * do mesmo assunto já grava na natureza há meses.
 *
 * Por isso o detalhe virou tela cheia com duas colunas lado a lado — o seu
 * ranking e o do território, na mesma régua — e um veredito escrito embaixo, com
 * os dois números dentro dele.
 */

function rowsFromDetail(
  detail: CreatorWeeklyReportDetail | null,
  groupId: string,
): PatternTerritoryRow[] {
  const group = detail?.groups.find((candidate) => candidate.id === groupId);
  if (!group) return [];
  return group.items
    .filter((item) => typeof item.index === "number" && Number.isFinite(item.index))
    .map((item) => ({ key: item.id, label: item.label, index: item.index as number }))
    .sort((a, b) => b.index - a.index)
    .slice(0, 4);
}

function BarList({
  title,
  rows,
  tone,
  highlightLabel,
}: {
  title: string;
  rows: PatternTerritoryRow[];
  tone: "own" | "territory";
  /** A linha promovida do criador, em tinta cheia. */
  highlightLabel?: string | null;
}) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((row) => row.index));
  const own = tone === "own";

  return (
    <div
      className={`rounded-[16px] p-4 ${
        own
          ? "border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]"
          : "border border-[var(--ds-color-line)] bg-[var(--ds-color-neutral)]"
      }`}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
        {title}
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.map((row) => {
          const promoted = own && highlightLabel === row.label;
          return (
            <div key={`${row.key}-${row.label}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`min-w-0 flex-1 text-[12.5px] font-medium leading-[1.25] ${
                    own ? "text-[var(--ds-color-ink)]" : "text-[var(--ds-color-text-secondary)]"
                  }`}
                >
                  {row.label}
                </span>
                <span
                  className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${
                    own ? "text-[var(--ds-color-text-secondary)]" : "text-[var(--ds-color-text-muted)]"
                  }`}
                >
                  {formatVerdictIndex(row.index)}
                </span>
              </div>
              <div className="mt-[5px] h-[3px] rounded-[2px] bg-[var(--ds-color-line)]">
                <div
                  className={`h-[3px] rounded-[2px] ${
                    promoted || own ? "bg-[var(--ds-color-ink)]" : "bg-[var(--ds-color-line-strong)]"
                  }`}
                  style={{ width: `${Math.max(4, Math.round((row.index / max) * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProfilePatternDetailSheet({
  highlight,
  detail,
  context,
  territoryExample,
  onClose,
}: {
  highlight: PatternHighlight | null;
  detail: CreatorWeeklyReportDetail | null;
  context: PatternContext | null;
  /** Um post do território para ilustrar o padrão, quando existir. */
  territoryExample?: TerritoryTrendPost | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  /**
   * Um overlay que não prende foco nem trava o fundo é overlay pela metade: no
   * celular o dedo rola a página de trás por baixo do painel, e no teclado o Tab
   * some para os cards escondidos atrás dele. As três coisas — Esc, trava de
   * rolagem e foco — vivem juntas porque começam e terminam no mesmo instante.
   */
  useEffect(() => {
    if (!highlight) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (document.activeElement === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      // Voltar o foco para o card que abriu o detalhe: sem isso quem navega por
      // teclado volta para o começo da página a cada padrão que consulta.
      previouslyFocused?.focus?.();
    };
  }, [highlight, onClose]);

  if (!highlight) return null;
  if (typeof document === "undefined") return null;

  const action = patternActionOf(highlight);
  const ownRows = rowsFromDetail(detail, highlight.groupId);
  const territoryRows = context?.territory?.rankings[highlight.groupId] ?? [];
  const series = trendSeriesOf(highlight, context);
  const trendText = describeTrend(series, highlight.value);
  const verdict =
    territoryRows.length > 0
      ? buildPatternVerdict({
          dimension: VERDICT_DIMENSION[highlight.groupId] ?? "essa dimensão",
          ownLabel: highlight.value,
          ownIndex: highlight.index,
          ownPosts: highlight.nPosts,
          ownRows,
          territoryRows,
        })
      : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-auto bg-[var(--ds-color-scrim)] px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pattern-detail-title"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-[430px] rounded-[26px] bg-[var(--ds-color-surface)] p-[22px] pb-7 shadow-[var(--ds-shadow-overlay)] outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
            {highlight.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border border-[var(--ds-color-line)] text-[15px] text-[var(--ds-color-text-secondary)]"
          >
            ✕
          </button>
        </div>

        <h2
          id="pattern-detail-title"
          className="mt-3.5 text-[22px] font-bold leading-[1.24] tracking-[-0.035em] text-[var(--ds-color-ink)]"
        >
          {action}
        </h2>

        <div className="mt-3.5 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <b className="block text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums text-[var(--ds-color-ink)]">
              {formatVerdictIndex(highlight.index)}
            </b>
            <span className="mt-[5px] block text-[11.5px] leading-[1.3] text-[var(--ds-color-text-muted)]">
              {highlight.support}
            </span>
          </div>
          <ProfileTrendBars series={series} height={26} width={6} />
        </div>

        {trendText ? (
          <p className="mt-3.5 text-[12.5px] leading-[1.5] text-[var(--ds-color-text-secondary)]">{trendText}</p>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BarList title="Seu ranking" rows={ownRows} tone="own" highlightLabel={highlight.value} />
          {territoryRows.length > 0 ? (
            <BarList
              title={context?.territory?.label ?? "Território"}
              rows={territoryRows}
              tone="territory"
            />
          ) : null}
        </div>

        {verdict ? (
          <div className="mt-3.5 rounded-[16px] border border-dashed border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
              {verdict.kicker}
            </p>
            <p className="mt-2.5 text-[15px] font-semibold leading-[1.36] tracking-[-0.005em] text-[var(--ds-color-ink)]">
              {verdict.text}
            </p>
          </div>
        ) : territoryRows.length === 0 ? (
          // Sem ranking do território não há veredito — e dizer isso é melhor do
          // que deixar a coluna sumir sem explicação.
          <p className="mt-3.5 text-[11.5px] leading-[1.5] text-[var(--ds-color-text-muted)]">
            Ainda não há leitura do seu território para comparar este padrão.
          </p>
        ) : null}

        {territoryExample ? (
          <div className="mt-3.5 rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
              Exemplo no território
            </p>
            <div className="mt-3 flex items-center gap-3">
              {territoryExample.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={territoryExample.coverUrl}
                  alt=""
                  className="h-[60px] w-[44px] shrink-0 rounded-[7px] object-cover"
                />
              ) : (
                <span className="h-[60px] w-[44px] shrink-0 rounded-[7px] bg-[var(--ds-color-neutral)]" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold leading-[1.3] text-[var(--ds-color-ink)]">
                  {territoryExample.description}
                </span>
                {territoryExample.creatorName ? (
                  <span className="mt-1 block text-[11.5px] leading-[1.25] text-[var(--ds-color-text-muted)]">
                    {territoryExample.creatorName}
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
