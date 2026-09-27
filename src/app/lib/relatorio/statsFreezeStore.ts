/**
 * statsFreezeStore.ts — ler e gravar os números congelados da semana.
 *
 * As regras moram em statsFreeze.ts; aqui só o banco.
 */

import { Types } from "mongoose";
import MetricModel from "@/app/models/Metric";
import WeeklyStatsFreezeModel from "@/app/models/WeeklyStatsFreeze";
import { logger } from "@/app/lib/logger";
import {
  entriesToFreeze,
  frozenStatsById,
  weekHasEnded,
  type FrozenStats,
} from "./statsFreeze";
import type { WeekWindow } from "./weekWindow";

const TAG = "[relatorio][statsFreeze]";

export interface FrozenWeek {
  stats: Map<string, FrozenStats>;
  /** Quando a semana ganhou os primeiros números congelados. null = nunca. */
  firstFrozenAt: Date | null;
}

export async function loadFrozenStats(weekKey: string): Promise<FrozenWeek> {
  const doc = (await WeeklyStatsFreezeModel.findOne({ weekKey })
    .select("posts createdAt")
    .lean()
    .exec()) as unknown as {
    posts?: Array<{ metric: Types.ObjectId; stats?: Record<string, unknown> }>;
    createdAt?: Date;
  } | null;
  if (!doc) return { stats: new Map(), firstFrozenAt: null };
  return { stats: frozenStatsById(doc.posts ?? []), firstFrozenAt: doc.createdAt ?? null };
}

export interface FreezeWeekResult {
  /** Posts da semana no banco agora. */
  total: number;
  alreadyFrozen: number;
  /** Congelados neste fechamento (em dry run: os que SERIAM congelados). */
  frozenNow: number;
  /** Sem alcance nem visualização ainda — esperam o próximo fechamento. */
  withoutStats: number;
  /** false quando a semana ainda não terminou: nada é congelado. */
  weekEnded: boolean;
}

/**
 * Congela os números dos posts da semana que já têm número e ainda não foram
 * congelados. Nunca reescreve um post já congelado. Em dry run só conta. Semana em
 * curso não congela nada (nem cria o documento).
 */
export async function freezeWeekStats(
  week: WeekWindow,
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<FreezeWeekResult> {
  const now = options.now ?? new Date();
  const [metrics, existing] = await Promise.all([
    MetricModel.find({ postDate: { $gte: week.startsAt, $lte: week.endsAt } }, { stats: 1 })
      .lean()
      .exec() as unknown as Promise<Array<{ _id: Types.ObjectId; stats?: Record<string, unknown> }>>,
    loadFrozenStats(week.weekKey),
  ]);

  const list = metrics.map((metric) => ({ id: String(metric._id), stats: metric.stats ?? null }));
  const alreadyFrozen = list.filter((metric) => existing.stats.has(metric.id)).length;
  const weekEnded = weekHasEnded(week, now);
  const toFreeze = weekEnded ? entriesToFreeze(list, new Set(existing.stats.keys())) : [];
  const withoutStats = weekEnded ? list.length - alreadyFrozen - toFreeze.length : 0;

  if (!weekEnded) {
    logger.warn(`${TAG} ${week.weekKey} ainda não terminou — nenhum número congelado.`);
  } else if (!options.dryRun) {
    // O documento nasce mesmo sem post medido: ele também marca "esta semana já fechou
    // com congelamento". Sem ele, uma segunda em que a Meta não devolveu número nenhum
    // faria a trava de refechamento barrar até a repetição do QStash.
    await WeeklyStatsFreezeModel.updateOne(
      { weekKey: week.weekKey },
      {
        $setOnInsert: { weekStartsAt: week.startsAt, weekEndsAt: week.endsAt },
        $push: {
          posts: {
            $each: toFreeze.map((entry) => ({
              metric: new Types.ObjectId(entry.id),
              stats: entry.stats,
              frozenAt: now,
            })),
          },
        },
      },
      { upsert: true },
    );
  }

  logger.info(
    `${TAG} ${week.weekKey}: ${list.length} posts · ${alreadyFrozen} já congelados · ` +
      `${toFreeze.length} ${options.dryRun ? "seriam congelados" : "congelados agora"} · ` +
      `${withoutStats} sem número ainda.`,
  );

  return { total: list.length, alreadyFrozen, frozenNow: toFreeze.length, withoutStats, weekEnded };
}
