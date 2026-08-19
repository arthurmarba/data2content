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

/**
 * Cor em um número só por tela: o maior resultado da semana.
 *
 * Pintar de verde tudo que passa de um corte não funciona — os padrões
 * promovidos já passaram da mediana por definição, então em quase toda semana
 * TODOS ficariam verdes, e verde em tudo é verde em nada. Um só faz o olho
 * pousar onde a decisão está.
 *
 * O rosa da marca fica reservado para AÇÃO (botões, "Abrir com o Pro"). Número
 * não é ação; se ele também for rosa, o olho deixa de saber onde tocar.
 */
function resultColorClass(isTop: boolean) {
  return isTop ? "text-[var(--ds-color-success)]" : "text-[var(--ds-color-ink)]";
}

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
  isTop,
  onToggle,
}: {
  highlight: PatternHighlight;
  group: CreatorWeeklyReportRankGroup | null;
  surface: "paper" | "neutral";
  expanded: boolean;
  locked: boolean;
  wide: boolean;
  /** O maior resultado da semana — o único número colorido da tela. */
  isTop: boolean;
  onToggle: () => void;
}) {
  const indexLabel = formatRankValue(highlight.index);
  const isAnswer = highlight.kind === "answer";
  const support = compactSupport(highlight.support);
  // Um resultado de um ou dois posts é aposta, não regra. O contorno tracejado já
  // significa "espera confirmação" no resto da tela — aqui ele faz o 17,0× de um
  // post ler como hipótese antes de alguém chegar na legenda.
  const unproven = isAnswer && highlight.evidence === "indicio";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={locked ? undefined : expanded}
      className={`rounded-[18px] p-[18px] text-left ${wide ? "col-span-2" : ""} ${
        surface === "paper"
          ? `bg-[var(--ds-color-surface)] ${unproven ? "border border-dashed border-[var(--ds-color-line-strong)]" : "border border-[var(--ds-color-line)]"}`
          : `bg-[var(--ds-color-neutral)] ${unproven ? "border border-dashed border-[var(--ds-color-line-strong)]" : ""}`
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
        ) : isAnswer ? (
          // A seta mora na linha do rótulo: sozinha num rodapé, ela deixava um
          // vão embaixo dos cards de valor curto.
          <span aria-hidden="true" className="text-[14px] text-[var(--ds-color-text-muted)]">
            {expanded ? "⌃" : "›"}
          </span>
        ) : null}
      </span>

      <span
        className={`mt-3 block tracking-[-0.03em] text-[var(--ds-color-ink)] ${
          isAnswer ? "text-[24px] font-semibold leading-[1.14]" : "text-[15px] font-semibold leading-[1.3]"
        }`}
      >
        {highlight.value}
      </span>

      {isAnswer ? (
        <span className="mt-3 flex items-baseline gap-2">
          {/* O multiplicador é o "e daí?" da resposta: sobe de 14 para 20px e vira
              par visual dela, em vez de nota de rodapé. */}
          <b className={`text-[20px] font-bold leading-none tracking-[-0.03em] tabular-nums ${resultColorClass(isTop)}`}>
            {indexLabel}
          </b>
          {support ? (
            <span className="text-[11.5px] leading-[1.3] text-[var(--ds-color-text-muted)]">{support}</span>
          ) : null}
        </span>
      ) : support ? (
        <span className="mt-3 block text-[11.5px] leading-[1.3] text-[var(--ds-color-text-muted)]">{support}</span>
      ) : null}

      {expanded && group ? <RankList group={group} surface={surface} /> : null}

      {/* O rodapé só existe quando há palavra a dizer: no card bloqueado, onde o
          convite é a informação nova. Nos demais, o card inteiro é o botão e a
          seta já está lá em cima — repetir "Ver ranking" dez vezes era ruído. */}
      {locked ? (
        <span className="mt-4 flex items-center justify-between text-[12px] font-semibold text-[var(--ds-color-brand-strong)]">
          <span>Abrir com o Pro</span>
          <span aria-hidden="true" className="text-[14px]">›</span>
        </span>
      ) : null}
    </button>
  );
}

function PatternGroup({
  title,
  highlights,
  surface,
  expandedId,
  lockedIds,
  topId,
  groupFor,
  onCardClick,
}: {
  title: string;
  highlights: PatternHighlight[];
  surface: "paper" | "neutral";
  expandedId: string | null;
  lockedIds: Set<string>;
  topId: string | null;
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
      <ProfileSectionHeader id={`pattern-group-${surface}`} title={title} level="group" />
      <div className="mt-3.5 grid grid-cols-2 gap-3.5">
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
              isTop={highlight.id === topId}
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
  // Dez cards de uma vez viram muro. Os três primeiros de "antes de gravar" são
  // os que decidem a próxima gravação — o resto fica a um toque de distância.
  const [showAll, setShowAll] = useState(false);

  if (highlights.length === 0) return null;

  const detailById = new Map(details.map((detail) => [detail.id, detail]));
  const groupFor = (highlight: PatternHighlight) =>
    detailById.get(highlight.detailId)?.groups.find((group) => group.id === highlight.groupId) ?? null;

  // O maior resultado da semana entre todos os padrões — inclusive o do destaque.
  const topId =
    [...highlights]
      .filter((highlight) => highlight.kind === "answer" && highlight.index !== null)
      .sort((a, b) => (b.index ?? 0) - (a.index ?? 0))[0]?.id ?? null;

  const hero = pickHeroHighlight(highlights);
  const grid = highlights.filter((highlight) => highlight.id !== hero?.id);
  const before = grid.filter((highlight) => patternGroupOf(highlight) === "before");
  const during = grid.filter((highlight) => patternGroupOf(highlight) === "during");
  const FIRST_BATCH = 3;
  const beforeShown = before.slice(0, FIRST_BATCH);
  const beforeRest = before.slice(FIRST_BATCH);
  const hiddenCount = beforeRest.length + during.length;

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
        className="text-[27px] font-bold leading-[1.14] tracking-[-0.035em] text-[var(--ds-color-ink)]"
      >
        {headline}
      </h2>
      {weekNumbers ? (
        <p className="mt-2.5 text-[13.5px] font-medium leading-[1.4] text-[var(--ds-color-text-secondary)]">
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
          className="mt-4 w-full rounded-[18px] border border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-6 text-left"
        >
          {/* A descoberta da semana e o padrão mais legível dividem o mesmo bloco:
              a manchete diz o quê, a abertura mostra em palavras do próprio vídeo. */}
          {headlineBlock}
          <span className="mt-[26px] flex items-center justify-between gap-2">
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
            <b className={`text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums ${resultColorClass(hero.id === topId)}`}>
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
        highlights={beforeShown}
        surface="paper"
        expandedId={expandedId}
        lockedIds={lockedIds}
        topId={topId}
        groupFor={groupFor}
        onCardClick={handleCardClick}
      />

      {showAll ? (
        <>
          {beforeRest.length > 0 ? (
            <div className="mt-3.5 grid grid-cols-2 gap-3.5">
              {beforeRest.map((highlight) => (
                <PatternCard
                  key={highlight.id}
                  highlight={highlight}
                  group={groupFor(highlight)}
                  surface="paper"
                  expanded={expandedId === highlight.id}
                  locked={lockedIds.has(highlight.id)}
                  wide={highlight.kind !== "answer" || highlight.value.length > WIDE_VALUE_LENGTH}
                  isTop={highlight.id === topId}
                  onToggle={() => handleCardClick(highlight, lockedIds.has(highlight.id))}
                />
              ))}
            </div>
          ) : null}
          <PatternGroup
            title="Na hora de gravar"
            highlights={during}
            surface="neutral"
            expandedId={expandedId}
            lockedIds={lockedIds}
            topId={topId}
            groupFor={groupFor}
            onCardClick={handleCardClick}
          />
        </>
      ) : null}

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          aria-expanded={showAll}
          className="mt-6 w-full rounded-[14px] border border-[var(--ds-color-line-strong)] p-[15px] text-[14px] font-semibold text-[var(--ds-color-ink)]"
        >
          {showAll
            ? `Esconder os outros ${hiddenCount} padrões`
            : `Ver os outros ${hiddenCount} padrões`}
        </button>
      ) : null}

      {nextStep ? (
        <div className="mt-[34px] rounded-[18px] border border-dashed border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-6">
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
