"use client";

import { useState } from "react";

import {
  buildPatternSections,
  RULE_CUT,
  type PatternSectionCard,
} from "@/app/lib/creatorWeeklyReport/patternSections";
import type { PatternHighlight } from "@/app/lib/creatorWeeklyReport/patternHighlights";
import {
  patternTrendKey,
  type PatternContext,
} from "@/app/lib/creatorWeeklyReport/patternContextTypes";

import { ProfileSectionHeader } from "./ProfileSectionHeader";
import { ProfileTrendBars } from "./ProfileTrendBars";

/**
 * Os padrões da semana, separados pelo que decide a próxima gravação.
 *
 * O corte não é mais o momento da produção ("antes de gravar" / "na hora"), e sim
 * a FORÇA DA EVIDÊNCIA — que é a pergunta que a pessoa realmente traz na segunda:
 * o que eu já posso repetir sem pensar, e o que ainda é aposta. Um 7,5× de um
 * post só e um 1,4× de dezesseis tinham o mesmo peso visual, separados por uma
 * etiqueta de 11px; agora estão sob títulos diferentes.
 *
 * A capa de cada card mostra a AÇÃO, não o rótulo da linha do ranking: "Tenha a
 * caneca de café em cena", não "Caneca de café". A tradução de substantivo para
 * decisão era trabalho que sobrava para quem lê.
 */

export function formatPatternIndexShort(index: number | null) {
  if (index === null || !Number.isFinite(index)) return "—";
  return `${index.toFixed(1).replace(".", ",")}×`;
}

/** A série de 4 semanas de um padrão promovido, quando existe. */
export function trendSeriesOf(
  highlight: PatternHighlight,
  context: PatternContext | null,
): number[] {
  const key = patternTrendKey(highlight.detailId, highlight.groupId, highlight.value);
  if (!key || !context) return [];
  return context.trends[key] ?? [];
}

function PatternCard({
  card,
  locked,
  series,
  onOpen,
}: {
  card: PatternSectionCard;
  locked: boolean;
  series: number[];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-[15px] text-left ${
        card.wide ? "col-span-2" : ""
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
          {card.highlight.label}
        </span>
        {locked ? (
          <span className="rounded-full bg-[var(--ds-color-brand-soft)] px-[9px] py-1 text-[10px] font-bold text-[var(--ds-color-brand-strong)]">
            Pro
          </span>
        ) : (
          <span aria-hidden="true" className="text-[13px] font-semibold text-[var(--ds-color-text-muted)]">
            ›
          </span>
        )}
      </span>

      <span className="mt-2.5 block text-[15px] font-semibold leading-[1.28] tracking-[-0.005em] text-[var(--ds-color-ink)]">
        {card.action}
      </span>

      <span className="mt-3 flex items-end gap-2.5">
        <span className="min-w-0 flex-1">
          <b className="block text-[22px] font-bold leading-none tracking-[-0.035em] tabular-nums text-[var(--ds-color-ink)]">
            {formatPatternIndexShort(card.highlight.index)}
          </b>
          <span className="mt-[5px] block text-[11.5px] leading-[1.3] text-[var(--ds-color-text-muted)]">
            {card.evidence}
          </span>
        </span>
        {locked ? null : <ProfileTrendBars series={series} />}
      </span>
    </button>
  );
}

function PatternGrid({
  cards,
  lockedIds,
  context,
  onOpen,
}: {
  cards: PatternSectionCard[];
  lockedIds: Set<string>;
  context: PatternContext | null;
  onOpen: (highlight: PatternHighlight, locked: boolean) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="mt-3.5 grid grid-cols-2 gap-3">
      {cards.map((card) => {
        const locked = lockedIds.has(card.highlight.id);
        return (
          <PatternCard
            key={card.highlight.id}
            card={card}
            locked={locked}
            series={trendSeriesOf(card.highlight, context)}
            onOpen={() => onOpen(card.highlight, locked)}
          />
        );
      })}
    </div>
  );
}

export function ProfilePatternSections({
  highlights,
  context,
  locked,
  reportTag,
  onOpenPattern,
  onLockedClick,
}: {
  highlights: PatternHighlight[];
  context: PatternContext | null;
  /** Quem não assina lê o exemplo, mas só abre o card mais forte. */
  locked: boolean;
  /** "Exemplo", "Pausado", "Parado em 10 de agosto" — o estado da leitura. */
  reportTag?: string | null;
  onOpenPattern: (highlight: PatternHighlight) => void;
  onLockedClick: () => void;
}) {
  const [waitingOpen, setWaitingOpen] = useState(false);
  if (highlights.length === 0) return null;

  const { rules, tests, waiting } = buildPatternSections(highlights, RULE_CUT);
  if (rules.length === 0 && tests.length === 0 && waiting.length === 0) return null;

  // O card mais forte de "já é regra" fica aberto para quem não assina: a pessoa
  // prova o produto num card real antes de encontrar o convite. É o mais forte, e
  // não o primeiro da grade — a grade é ordenada para fechar pares de meia
  // largura, e deixar a amostra grátis depender disso seria acidente.
  const strongest = (cards: typeof rules) =>
    [...cards].sort((a, b) => (b.highlight.index ?? 0) - (a.highlight.index ?? 0))[0] ?? null;
  const freeId = (strongest(rules) ?? strongest(tests))?.highlight.id ?? null;
  const lockedIds = new Set(
    locked ? highlights.filter((highlight) => highlight.id !== freeId).map((highlight) => highlight.id) : [],
  );

  const handleOpen = (highlight: PatternHighlight, isLocked: boolean) => {
    if (isLocked) {
      onLockedClick();
      return;
    }
    onOpenPattern(highlight);
  };

  return (
    <>
      {rules.length > 0 ? (
        <section aria-labelledby="pattern-rules-title">
          <ProfileSectionHeader id="pattern-rules-title" title="O que já é regra" tag={reportTag ?? null} />
          <PatternGrid cards={rules} lockedIds={lockedIds} context={context} onOpen={handleOpen} />
        </section>
      ) : null}

      {tests.length > 0 ? (
        <section aria-labelledby="pattern-tests-title">
          <ProfileSectionHeader
            id="pattern-tests-title"
            title="O que vale testar"
            tag={rules.length === 0 ? reportTag ?? null : null}
            level={rules.length > 0 ? "group" : "section"}
          />
          <PatternGrid cards={tests} lockedIds={lockedIds} context={context} onOpen={handleOpen} />
        </section>
      ) : null}

      {waiting.length > 0 ? (
        // A terceira lista não some: ela é a prova de que a leitura olhou aquelas
        // dimensões e não encontrou nada — silêncio ali seria lido como esquecimento.
        // Fechada, ocupa uma linha.
        <div className="mt-3.5">
          <button
            type="button"
            onClick={() => setWaitingOpen((value) => !value)}
            aria-expanded={waitingOpen}
            className="w-full rounded-[16px] border border-dashed border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-[15px] text-left"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
                Esperando mais posts
              </span>
              <span
                aria-hidden="true"
                className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[var(--ds-color-neutral)] text-[13px] font-bold text-[var(--ds-color-text-secondary)]"
              >
                {waitingOpen ? "–" : "+"}
              </span>
            </span>
            <span className="mt-2.5 block text-[15px] font-semibold leading-[1.28] text-[var(--ds-color-text-secondary)]">
              {waiting.length === 1 ? "1 padrão" : `${waiting.length} padrões`}
            </span>
            {waitingOpen ? (
              <span className="mt-3.5 block border-t border-dashed border-[var(--ds-color-line)] pt-3">
                {waiting.map((item) => (
                  <span
                    key={item.id}
                    className="flex justify-between gap-2.5 py-1 text-[12.5px] leading-[1.3] text-[var(--ds-color-text-muted)]"
                  >
                    <span className="text-[var(--ds-color-ink)]">{item.name}</span>
                    <span className="text-right">{item.note}</span>
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        </div>
      ) : null}
    </>
  );
}
