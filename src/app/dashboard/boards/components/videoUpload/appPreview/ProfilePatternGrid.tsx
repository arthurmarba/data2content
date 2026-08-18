"use client";

import { useState } from "react";

import {
  buildNextStepLine,
  formatPatternIndex,
  type PatternHighlight,
} from "@/app/lib/creatorWeeklyReport/patternHighlights";
import type {
  CreatorWeeklyReportDetail,
  CreatorWeeklyReportRankGroup,
} from "@/app/lib/creatorWeeklyReport/types";

import { PatternRankGroups } from "./PatternRankGroups";

/**
 * Os padrões da semana com a RESPOSTA na capa.
 *
 * Antes eles viviam em quatro linhas cinzas ("Dia e horário ›") no fim de um
 * bloco de texto: quem rolava lendo nunca tocava e saía sem saber que existia
 * resposta ali. Aqui a resposta é a capa, e o toque serve para se aprofundar —
 * abrindo o ranking no próprio lugar, sem trocar de tela, para que dois padrões
 * possam ser comparados sem perder o fio.
 */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? "-rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PatternCard({
  highlight,
  detail,
  group,
  expanded,
  locked,
  fillRow,
  onToggle,
}: {
  highlight: PatternHighlight;
  detail: CreatorWeeklyReportDetail | null;
  group: CreatorWeeklyReportRankGroup | null;
  expanded: boolean;
  locked: boolean;
  /** Ímpar sobrando na grade de duas colunas: ocupa a linha em vez de deixar buraco. */
  fillRow: boolean;
  onToggle: () => void;
}) {
  const indexLabel = formatPatternIndex(highlight.index);
  const isAnswer = highlight.kind === "answer";
  // Uma coluna no celular: as respostas daqui são frases ("Maternidade sem
  // idealização", uma abertura inteira), não números de três caracteres — em meia
  // largura de 375px elas quebram em quatro linhas e a manchete deixa de ler como
  // manchete. A partir de tablet, onde a linha comporta, a grade abre em duas.
  // A abertura e a leitura de fallback ocupam a linha inteira em qualquer largura.
  const wide = expanded || fillRow || !isAnswer || highlight.detailId === "openings";

  return (
    <div
      className={`rounded-[var(--ds-radius-md)] border bg-[var(--ds-color-paper)] transition-colors ${
        wide ? "sm:col-span-2" : ""
      } ${expanded ? "border-[var(--ds-color-line-strong)]" : "border-[var(--ds-color-line)]"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-2 rounded-[var(--ds-radius-md)] p-3.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-semibold text-[var(--ds-color-text-muted)]">{highlight.label}</span>
            {locked ? <span className="ds-notebook-tag !py-0 text-[10px] font-semibold">Pro</span> : null}
          </span>
          <span
            className={`mt-1 block ${
              isAnswer
                ? "text-[15px] font-bold leading-[1.2] tracking-[-0.01em] text-[var(--ds-color-ink)]"
                : "text-[13px] font-semibold leading-[1.35] text-[var(--ds-color-text-secondary)]"
            } ${locked ? "select-none blur-[5px]" : ""}`}
          >
            {highlight.value}
          </span>
          {/* O número fica visível mesmo bloqueado: saber que algo rendeu 7,5× sem
              saber o quê é o convite honesto — um borrão sozinho não diz nada. */}
          {indexLabel ? (
            <span className="mt-1 block text-[11.5px] font-semibold text-[var(--ds-color-success)]">{indexLabel}</span>
          ) : null}
          {!locked && !indexLabel && highlight.support ? (
            <span className="mt-1 block text-[11.5px] text-[var(--ds-color-text-muted)]">{highlight.support}</span>
          ) : null}
          {!locked && indexLabel && highlight.support ? (
            <span className="mt-0.5 block text-[11px] text-[var(--ds-color-text-muted)]">{highlight.support}</span>
          ) : null}
        </span>
        <span className="mt-0.5 shrink-0 text-[var(--ds-color-text-muted)]">
          <ChevronIcon open={expanded} />
        </span>
      </button>

      {expanded && group ? (
        <div className="border-t border-[var(--ds-color-line)] px-3.5 pb-4 pt-3">
          {/* Só o ranking DESTE card. A leitura do detalhe entra junto porque é o
              contexto que impede o número de ser lido como regra. */}
          {detail?.interpretation ? (
            <p className="mb-3 text-[13px] leading-[1.45] text-[var(--ds-color-text-secondary)]">
              {detail.interpretation}
            </p>
          ) : null}
          <PatternRankGroups groups={[group]} idPrefix={`pattern-${highlight.id}`} />
          {detail?.coverageLabel ? <p className="ds-caption mt-2">{detail.coverageLabel}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProfilePatternGrid({
  highlights,
  details,
  locked,
  onExpand,
  onLockedClick,
}: {
  highlights: PatternHighlight[];
  details: CreatorWeeklyReportDetail[];
  /** Quem não assina vê o primeiro padrão aberto e os demais borrados. */
  locked: boolean;
  onExpand: (highlight: PatternHighlight) => void;
  onLockedClick: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (highlights.length === 0) return null;

  const detailById = new Map(details.map((detail) => [detail.id, detail]));
  const groupFor = (highlight: PatternHighlight) =>
    detailById.get(highlight.detailId)?.groups.find((group) => group.id === highlight.groupId) ?? null;
  const nextStep = locked ? null : buildNextStepLine(highlights);

  return (
    <div className="mt-5">
      <span className="ds-notebook-label">O que a semana mostrou</span>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(() => {
          // Quantos cards cabem em meia largura — o último deles ocupa a linha
          // inteira quando o total é ímpar, para a grade não terminar com um vazio.
          const halfIds = highlights
            .filter((item) => item.kind === "answer" && item.detailId !== "openings")
            .map((item) => item.id);
          const oddOneOut = halfIds.length % 2 === 1 ? halfIds[halfIds.length - 1] : null;
          return highlights.map((highlight, position) => {
          // O primeiro card fica aberto de verdade para quem não assina: a pessoa
          // prova um pedaço e entende o que está comprando, em vez de encarar um
          // cadeado sobre uma tela vazia.
          const cardLocked = locked && position > 0;
          const expanded = expandedId === highlight.id;
          return (
            <PatternCard
              key={highlight.id}
              highlight={highlight}
              detail={detailById.get(highlight.detailId) ?? null}
              group={groupFor(highlight)}
              expanded={expanded}
              locked={cardLocked}
              fillRow={highlight.id === oddOneOut}
              onToggle={() => {
                if (cardLocked) {
                  onLockedClick();
                  return;
                }
                if (expanded) {
                  setExpandedId(null);
                  return;
                }
                setExpandedId(highlight.id);
                onExpand(highlight);
              }}
            />
          );
          });
        })()}
      </div>

      {nextStep ? (
        <div className="mt-3 rounded-[var(--ds-radius-md)] bg-[var(--ds-color-brand-soft)] px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-[var(--ds-color-brand-strong)]">
            Seu próximo passo
          </span>
          <p className="mt-1 text-[13.5px] leading-[1.4] text-[var(--ds-color-ink)]">{nextStep}</p>
        </div>
      ) : null}
    </div>
  );
}
