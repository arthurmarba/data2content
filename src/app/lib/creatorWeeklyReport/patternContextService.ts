// src/app/lib/creatorWeeklyReport/patternContextService.ts
//
// Duas leituras de banco, ambas de dado JÁ CONGELADO — nenhuma agregação nova.
//
//   1. as últimas semanas do relatório DESTE criador, para a série do padrão;
//   2. o último snapshot do território dele, para o ranking de comparação.
//
// Os dois já existiam e ninguém olhava. `CreatorWeeklyReport` guarda uma linha
// por semana com o ranking inteiro daquela semana; `WeeklyTerritoryReport` guarda
// o ranking do território congelado no dia em que a semana fechou (e é congelado
// justamente porque `Metric.stats` é cumulativo — recalcular daria outro número).
//
// Custo: duas queries por índice, sem varredura de coleção.

import mongoose from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorWeeklyReport from "@/app/models/CreatorWeeklyReport";
import WeeklyTerritoryReportModel, {
  type IWeeklyTerritoryElement,
} from "@/app/models/WeeklyTerritoryReport";
import { loadMapProfiles, type MapProfile } from "@/app/lib/relatorio/mapProfiles";
import { logger } from "@/app/lib/logger";

import {
  EMPTY_PATTERN_CONTEXT,
  PATTERN_TREND_WEEKS,
  TERRITORY_KIND_BY_GROUP,
  patternTrendKey,
  type PatternContext,
  type PatternTerritoryRow,
} from "./patternContextTypes";
import type { CreatorWeeklyReportPayload } from "./types";

const TAG = "[creatorWeeklyReport][patternContext]";

/** Quantas linhas de cada ranking do território a tela mostra. */
const TERRITORY_ROWS = 4;

/**
 * A métrica que vira o índice do território.
 *
 * Cada tabela de lá declara a própria ordenação (`sortedBy`), e é ela que deve
 * mandar: a tabela de enquadramento é ordenada por retenção porque enquadramento
 * mexe em retenção. Só quando o snapshot não trouxer aquela métrica é que se cai
 * para engajamento, que existe em todas.
 */
function indexOfElement(
  element: IWeeklyTerritoryElement,
  preferred: string | undefined,
): number | null {
  const metrics = element.metrics ?? [];
  const pick = (metric: string) => metrics.find((entry) => entry.metric === metric)?.index ?? null;
  const value =
    (preferred ? pick(preferred) : null) ?? pick("engajamento") ?? metrics[0]?.index ?? null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * O território mede a célula dia×horário junta ("Qui 4–8h") — é o que a reunião
 * usa. A leitura do criador separa dia de horário, então cada metade da chave
 * vira uma linha, agregada pela MELHOR célula daquele dia (ou daquela faixa).
 *
 * Média seria mais defensável estatisticamente e menos verdadeira aqui: a
 * pergunta do card é "quinta rende?", e quinta rende no horário em que se posta
 * na quinta, não na média das seis faixas do dia.
 */
function splitTimeGrid(
  elements: IWeeklyTerritoryElement[],
  preferred: string | undefined,
  side: "day" | "slot",
): PatternTerritoryRow[] {
  const best = new Map<string, PatternTerritoryRow>();
  for (const element of elements) {
    const [dayPart, slotPart] = String(element.key).split("|");
    const labelParts = String(element.label).trim().split(/\s+/);
    const key = side === "day" ? dayPart : slotPart;
    const label = side === "day" ? labelParts[0] : labelParts.slice(1).join(" ");
    const index = indexOfElement(element, preferred);
    if (!key || !label || index === null) continue;
    const current = best.get(key);
    if (!current || index > current.index) best.set(key, { key, label, index });
  }
  return [...best.values()].sort((a, b) => b.index - a.index).slice(0, TERRITORY_ROWS);
}

export function rankingsFrom(document: {
  elements: IWeeklyTerritoryElement[];
  sortedBy?: Record<string, string> | null;
}): Record<string, PatternTerritoryRow[]> {
  const byKind = new Map<string, IWeeklyTerritoryElement[]>();
  for (const element of document.elements ?? []) {
    const list = byKind.get(element.kind) ?? [];
    list.push(element);
    byKind.set(element.kind, list);
  }

  const sortedBy = document.sortedBy ?? {};
  const rankings: Record<string, PatternTerritoryRow[]> = {};

  for (const [groupId, kind] of Object.entries(TERRITORY_KIND_BY_GROUP)) {
    const elements = byKind.get(kind);
    if (!elements?.length) continue;
    const rows = elements
      .map((element) => ({
        key: String(element.key),
        label: String(element.label),
        index: indexOfElement(element, sortedBy[kind]),
      }))
      .filter((row): row is PatternTerritoryRow => row.index !== null)
      .sort((a, b) => b.index - a.index)
      .slice(0, TERRITORY_ROWS);
    if (rows.length > 0) rankings[groupId] = rows;
  }

  const timeElements = byKind.get("horario");
  if (timeElements?.length) {
    const day = splitTimeGrid(timeElements, sortedBy.horario, "day");
    const slot = splitTimeGrid(timeElements, sortedBy.horario, "slot");
    if (day.length > 0) rankings.weekday = day;
    if (slot.length > 0) {
      rankings["time-slot"] = slot;
      rankings.time = slot;
    }
  }

  return rankings;
}

/**
 * A série de cada padrão nas últimas semanas.
 *
 * Lê os relatórios já gravados — não recalcula nada. Semana em que o item não
 * apareceu no ranking entra como 0, e a barra vazia é informação: quer dizer
 * "naquela semana você não fez isso", que é diferente de "rendeu pouco".
 */
export function trendsFrom(payloads: CreatorWeeklyReportPayload[]): Record<string, number[]> {
  const weeks = payloads.length;
  const trends: Record<string, number[]> = {};

  payloads.forEach((payload, position) => {
    for (const detail of payload.details ?? []) {
      for (const group of detail.groups ?? []) {
        for (const item of group.items ?? []) {
          const key = patternTrendKey(detail.id, group.id, item.label);
          if (!key) continue;
          const series = trends[key] ?? new Array<number>(weeks).fill(0);
          const index = typeof item.index === "number" && Number.isFinite(item.index) ? item.index : 0;
          // Um rótulo pode aparecer em mais de um ranking do mesmo grupo na
          // mesma semana (assunto mais forte é um item por post): fica o maior.
          series[position] = Math.max(series[position] ?? 0, index);
          trends[key] = series;
        }
      }
    }
  });

  return trends;
}

export async function loadPatternContext(userId: string): Promise<PatternContext> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return EMPTY_PATTERN_CONTEXT;
  await connectToDatabase();

  const [reports, profiles] = await Promise.all([
    CreatorWeeklyReport.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ periodEndsAt: -1 })
      .limit(PATTERN_TREND_WEEKS)
      .select("payload")
      .lean<Array<{ payload: CreatorWeeklyReportPayload }>>(),
    loadMapProfiles([userId]).catch((error): Map<string, MapProfile> => {
      logger.warn(`${TAG} mapa do criador indisponível — o território sai vazio`, error);
      return new Map();
    }),
  ]);

  // Do mais antigo para o mais recente: a última barra é a semana que acabou.
  const payloads = reports
    .map((document) => document.payload)
    .filter(Boolean)
    .reverse();

  const territoryId = profiles.get(userId)?.primaryTerritoryId ?? null;
  let territory: PatternContext["territory"] = null;

  if (territoryId) {
    const snapshot = await WeeklyTerritoryReportModel.findOne({ territoryId })
      .sort({ weekStartsAt: -1 })
      .select("weekKey territoryId territoryLabel sortedBy elements")
      .lean<{
        weekKey: string;
        territoryId: string;
        territoryLabel: string;
        sortedBy?: Record<string, string> | null;
        elements: IWeeklyTerritoryElement[];
      } | null>();

    if (snapshot) {
      const rankings = rankingsFrom(snapshot);
      if (Object.keys(rankings).length > 0) {
        territory = {
          id: snapshot.territoryId,
          label: snapshot.territoryLabel,
          weekKey: snapshot.weekKey,
          rankings,
        };
      }
    }
  }

  return { trends: trendsFrom(payloads), weeks: payloads.length || PATTERN_TREND_WEEKS, territory };
}
