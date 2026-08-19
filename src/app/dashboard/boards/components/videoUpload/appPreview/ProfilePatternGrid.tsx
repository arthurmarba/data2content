"use client";

import { useState } from "react";

import {
  buildNextStepLine,
  patternGroupOf,
  pickHeroHighlight,
  type PatternHighlight,
} from "@/app/lib/creatorWeeklyReport/patternHighlights";
import type {
  CreatorWeeklyReportDetail,
  CreatorWeeklyReportRankGroup,
} from "@/app/lib/creatorWeeklyReport/types";

import { ProfileSectionHeader } from "./ProfileSectionHeader";

/**
 * Os padrões da semana com a RESPOSTA na capa.
 *
 * Sem casca-pai: os cards repousam direto no canvas da página, o que devolve
 * ~40px de largura no celular e permite a resposta em 22px. A grade tem span
 * variável porque as respostas daqui são frases de tamanho desigual ("Quinta"
 * ao lado de "Maternidade sem idealização").
 *
 * O agrupamento — "antes de gravar" / "na hora de gravar" — é a distinção
 * visual entre os cards, e vem reforçada pela superfície: o primeiro grupo é
 * branco com contorno, o segundo é preenchido em neutro. Sem ícone, sem cor
 * por categoria, sem emoji.
 */

/** Valor curto cabe em meia largura; frase ocupa a linha inteira. */
const WIDE_VALUE_LENGTH = 16;

function formatRankValue(index: number | null) {
  if (index === null || !Number.isFinite(index)) return "—";
  return `${index.toFixed(1).replace(".", ",")}×`;
}

/** "7 posts em 90 dias · vale testar" → "7 posts · vale testar" na capa. */
function compactSupport(support: string | null) {
  return support ? support.replace(" em 90 dias", "") : null;
}

function RankList({
  group,
  surface,
}: {
  group: CreatorWeeklyReportRankGroup;
  surface: "paper" | "neutral";
}) {
  return (
    <div
      className={`mt-3 overflow-hidden rounded-[var(--ds-radius-sm)] px-3 py-2 ${
        surface === "paper" ? "bg-[var(--ds-color-neutral)]" : "bg-[var(--ds-color-surface)]"
      }`}
    >
      {group.items.map((item) => (
        <div
          key={item.id}
          className="flex items-baseline justify-between gap-3 py-1 text-[12.5px] leading-[1.3]"
        >
          <span className="min-w-0 flex-1 text-[var(--ds-color-ink)]">{item.label}</span>
          <span className="tabular-nums text-[var(--ds-color-text-secondary)]">
            {formatRankValue(item.index)}
          </span>
        </div>
      ))}
    </div>
  );
}

function PatternCard({
  highlight,
  group,
  surface,
  expanded,
  locked,
  wide,
  onToggle,
}: {
  highlight: PatternHighlight;
  group: CreatorWeeklyReportRankGroup | null;
  surface: "paper" | "neutral";
  expanded: boolean;
  locked: boolean;
  wide: boolean;
  onToggle: () => void;
}) {
  const indexLabel = formatRankValue(highlight.index);
  const isAnswer = highlight.kind === "answer";
  const support = compactSupport(highlight.support);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={locked ? undefined : expanded}
      className={`rounded-[var(--ds-radius-md)] p-[15px] text-left ${wide ? "col-span-2" : ""} ${
        surface === "paper"
          ? "border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]"
          : "bg-[var(--ds-color-neutral)]"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
          {highlight.label}
        </span>
        {locked ? (
          <span className="rounded-full border border-dashed border-[var(--ds-color-line-strong)] px-2 py-[3px] text-[10px] font-semibold text-[var(--ds-color-text-secondary)]">
            Pro
          </span>
        ) : null}
      </span>

      <span
        className={`mt-2 block tracking-[-0.03em] text-[var(--ds-color-ink)] ${
          isAnswer ? "text-[22px] font-semibold leading-[1.12]" : "text-[15px] font-semibold leading-[1.3]"
        }`}
      >
        {highlight.value}
      </span>

      {isAnswer ? (
        <span className="mt-2 flex items-baseline gap-[7px]">
          <b className="text-[14px] font-bold tracking-[-0.02em] tabular-nums text-[var(--ds-color-ink)]">
            {indexLabel}
          </b>
          {support ? (
            <span className="text-[11px] leading-[1.3] text-[var(--ds-color-text-muted)]">{support}</span>
          ) : null}
        </span>
      ) : null}

      {expanded && group ? <RankList group={group} surface={surface} /> : null}

      <span
        className={`mt-3 flex items-center justify-between text-[11.5px] font-semibold ${
          locked ? "text-[var(--ds-color-brand-strong)]" : "text-[var(--ds-color-text-secondary)]"
        }`}
      >
        <span>{locked ? "Abrir com o Pro" : expanded ? "Fechar" : "Ver ranking"}</span>
        <span aria-hidden="true">{locked ? "›" : expanded ? "⌃" : "›"}</span>
      </span>
    </button>
  );
}

function PatternGroup({
  title,
  highlights,
  surface,
  expandedId,
  lockedIds,
  groupFor,
  onCardClick,
}: {
  title: string;
  highlights: PatternHighlight[];
  surface: "paper" | "neutral";
  expandedId: string | null;
  lockedIds: Set<string>;
  groupFor: (highlight: PatternHighlight) => CreatorWeeklyReportRankGroup | null;
  onCardClick: (highlight: PatternHighlight, locked: boolean) => void;
}) {
  if (highlights.length === 0) return null;

  // Os de meia largura vêm primeiro para fecharem pares: intercalados com os de
  // linha inteira, cada um deles deixaria metade de uma linha vazia. E quando
  // sobra um ímpar, ele ocupa a linha em vez de terminar a grade com um buraco.
  const isNarrow = (highlight: PatternHighlight) =>
    highlight.kind === "answer" && highlight.value.length <= WIDE_VALUE_LENGTH;
  const ordered = [...highlights.filter(isNarrow), ...highlights.filter((h) => !isNarrow(h))];
  const narrow = ordered.filter(isNarrow);
  const oddOneOut = narrow.length % 2 === 1 ? narrow[narrow.length - 1]?.id ?? null : null;

  return (
    <section aria-labelledby={`pattern-group-${surface}`}>
      <ProfileSectionHeader id={`pattern-group-${surface}`} title={title} className="mt-[22px]" />
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {ordered.map((highlight) => {
          const locked = lockedIds.has(highlight.id);
          const wide = !isNarrow(highlight) || highlight.id === oddOneOut;
          return (
            <PatternCard
              key={highlight.id}
              highlight={highlight}
              group={groupFor(highlight)}
              surface={surface}
              expanded={expandedId === highlight.id}
              locked={locked}
              wide={wide}
              onToggle={() => onCardClick(highlight, locked)}
            />
          );
        })}
      </div>
    </section>
  );
}

export function ProfilePatternGrid({
  highlights,
  details,
  headline,
  weekNumbers,
  locked,
  onExpand,
  onLockedClick,
}: {
  highlights: PatternHighlight[];
  details: CreatorWeeklyReportDetail[];
  /** A descoberta da semana abre o bloco de destaque, junto do padrão mais legível. */
  headline: string;
  weekNumbers: string | null;
  /** Quem não assina lê o relatório de exemplo, mas só abre o ranking do primeiro. */
  locked: boolean;
  onExpand: (highlight: PatternHighlight) => void;
  onLockedClick: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (highlights.length === 0) return null;

  const detailById = new Map(details.map((detail) => [detail.id, detail]));
  const groupFor = (highlight: PatternHighlight) =>
    detailById.get(highlight.detailId)?.groups.find((group) => group.id === highlight.groupId) ?? null;

  const hero = pickHeroHighlight(highlights);
  const grid = highlights.filter((highlight) => highlight.id !== hero?.id);
  const before = grid.filter((highlight) => patternGroupOf(highlight) === "before");
  const during = grid.filter((highlight) => patternGroupOf(highlight) === "during");

  // O primeiro card de "antes de gravar" fica aberto para quem não assina: a
  // pessoa prova o produto num card real antes de encontrar o convite.
  const freeId = before[0]?.id ?? null;
  const lockedIds = new Set(
    locked ? highlights.filter((highlight) => highlight.id !== freeId).map((highlight) => highlight.id) : [],
  );

  const handleCardClick = (highlight: PatternHighlight, isLocked: boolean) => {
    if (isLocked) {
      onLockedClick();
      return;
    }
    if (expandedId === highlight.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(highlight.id);
    onExpand(highlight);
  };

  const nextStep = buildNextStepLine(highlights);

  const headlineBlock = (
    <>
      <h2
        id="weekly-report-title"
        className="text-[24px] font-bold leading-[1.14] tracking-[-0.035em] text-[var(--ds-color-ink)]"
      >
        {headline}
      </h2>
      {weekNumbers ? (
        <p className="mt-2.5 text-[13px] font-medium leading-[1.4] text-[var(--ds-color-text-secondary)]">
          {weekNumbers}
        </p>
      ) : null}
    </>
  );

  return (
    <>
      {hero ? (
        <button
          type="button"
          onClick={() => handleCardClick(hero, lockedIds.has(hero.id))}
          aria-expanded={lockedIds.has(hero.id) ? undefined : expandedId === hero.id}
          className="mt-3 w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-[18px] text-left"
        >
          {/* A descoberta da semana e o padrão mais legível dividem o mesmo bloco:
              a manchete diz o quê, a abertura mostra em palavras do próprio vídeo. */}
          {headlineBlock}
          <span className="mt-5 flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
              {hero.label}
            </span>
            {lockedIds.has(hero.id) ? (
              <span className="rounded-full border border-dashed border-[var(--ds-color-line-strong)] px-2 py-[3px] text-[10px] font-semibold text-[var(--ds-color-text-secondary)]">
                Pro
              </span>
            ) : null}
          </span>
          <span className="mt-2.5 block text-[21px] font-semibold leading-[1.25] tracking-[-0.03em] text-[var(--ds-color-ink)]">
            “{hero.value}”
          </span>
          <span className="mt-2.5 flex items-baseline gap-2">
            <b className="text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums text-[var(--ds-color-ink)]">
              {formatRankValue(hero.index)}
            </b>
            {compactSupport(hero.support) ? (
              <span className="text-[11.5px] text-[var(--ds-color-text-muted)]">{compactSupport(hero.support)}</span>
            ) : null}
          </span>
          {expandedId === hero.id && groupFor(hero) ? (
            <RankList group={groupFor(hero)!} surface="paper" />
          ) : null}
          <span
            className={`mt-3.5 flex items-center justify-between text-[12.5px] font-semibold ${
              lockedIds.has(hero.id) ? "text-[var(--ds-color-brand-strong)]" : "text-[var(--ds-color-text-secondary)]"
            }`}
          >
            <span>
              {lockedIds.has(hero.id) ? "Abrir o ranking com o Pro" : expandedId === hero.id ? "Fechar" : "Ver ranking"}
            </span>
            <span aria-hidden="true">{expandedId === hero.id && !lockedIds.has(hero.id) ? "⌃" : "›"}</span>
          </span>
        </button>
      ) : null}

      {hero ? null : <div className="mt-3">{headlineBlock}</div>}

      <PatternGroup
        title="Antes de gravar"
        highlights={before}
        surface="paper"
        expandedId={expandedId}
        lockedIds={lockedIds}
        groupFor={groupFor}
        onCardClick={handleCardClick}
      />
      <PatternGroup
        title="Na hora de gravar"
        highlights={during}
        surface="neutral"
        expandedId={expandedId}
        lockedIds={lockedIds}
        groupFor={groupFor}
        onCardClick={handleCardClick}
      />

      {nextStep ? (
        <div className="mt-[18px] rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-[18px]">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--ds-color-text-muted)]">
            Seu próximo passo
          </span>
          <p className="mt-2.5 text-[18px] font-semibold leading-[1.3] tracking-[-0.02em] text-[var(--ds-color-ink)]">
            {nextStep}
          </p>
        </div>
      ) : null}
    </>
  );
}
