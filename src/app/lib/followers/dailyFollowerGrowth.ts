/**
 * Ganho de seguidores por dia, derivado dos snapshots de conta que já são
 * gravados a cada sincronização do Instagram (`AccountInsight.followersCount`).
 *
 * A API do Instagram não entrega "seguidores ganhos no dia" para a janela que a
 * gente quiser: o que existe é o total de seguidores no instante da leitura.
 * O ganho diário é, portanto, uma diferença entre dois fechamentos — e é assim
 * que ele precisa ser apresentado, com duas honestidades embutidas:
 *
 * 1. Ganho é líquido. Quem seguiu menos quem deixou de seguir. Dia negativo é
 *    informação, não erro.
 * 2. Dia sem leitura não vira zero. Se houve buraco, a diferença seguinte cobre
 *    mais de um dia e é marcada como tal — nunca dividida entre os dias.
 */
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import AccountInsightModel from "@/app/models/AccountInsight";

export const DAILY_FOLLOWER_GROWTH_SCHEMA_VERSION = "daily_follower_growth_v1";

export interface DailyFollowerPoint {
  /** Dia civil no fuso pedido. */
  date: string;
  /** Total de seguidores na última leitura daquele dia. */
  followersAtEndOfDay: number;
  /** Variação líquida desde o fechamento anterior. `null` quando não há anterior. */
  netGain: number | null;
  /** Quantos dias essa variação cobre. Maior que 1 significa buraco na coleta. */
  daysCovered: number | null;
  /** Quantas leituras existiam nesse dia. */
  readings: number;
  /** Instante exato da leitura usada como fechamento. */
  measuredAt: string;
  /**
   * `false` no dia que ainda está correndo: o "fechamento" dele é parcial, e o
   * saldo tende a parecer menor do que vai ser.
   */
  dayIsComplete: boolean;
}

export interface DailyFollowerGrowth {
  schemaVersion: typeof DAILY_FOLLOWER_GROWTH_SCHEMA_VERSION;
  period: { startDate: string; endDate: string; timeZone: string };
  days: DailyFollowerPoint[];
  summary: {
    /**
     * Soma das variações medidas. Com referência anterior, é o crescimento do
     * período inteiro; sem ela, é o crescimento do primeiro ao último dia medido.
     */
    netGain: number | null;
    followersAtStart: number | null;
    followersAtEnd: number | null;
    /** Média por dia efetivamente medido, não por dia do calendário. */
    averageGainPerMeasuredDay: number | null;
    /** Saldo parcial do dia em curso, quando o período inclui hoje. */
    inProgressDay: { date: string; netGain: number | null } | null;
    bestDay: { date: string; netGain: number } | null;
    worstDay: { date: string; netGain: number } | null;
    daysWithLoss: number;
  };
  coverage: {
    calendarDays: number;
    daysWithReading: number;
    measuredDayToDayTransitions: number;
    transitionsSpanningGaps: number;
    hasBaselineBeforePeriod: boolean;
    firstReadingAt: string | null;
    lastReadingAt: string | null;
    warnings: string[];
  };
  receipt: {
    generatedAt: string;
    source: "account_followers_snapshot_difference";
    /** O total de seguidores é lido do Instagram; o ganho diário é calculado aqui. */
    gainIsDerivedNotReportedByInstagram: true;
    gainIsNetOfUnfollows: true;
    gapsAreNotSpreadAcrossDays: true;
    noPaidModelCalls: true;
    notes: string[];
  };
}

export type DailyFollowerClose = {
  date: string;
  followers: number;
  measuredAt: Date;
  readings: number;
};
export type DailyFollowerBaseline = { followers: number; measuredAt: Date; date: string };

function calendarDaysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Dia civil de um instante, no fuso pedido — o mesmo formato do $dateToString. */
function civilDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function daysApart(previous: string, current: string): number {
  const from = Date.parse(`${previous}T00:00:00Z`);
  const to = Date.parse(`${current}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 1;
  return Math.max(1, Math.round((to - from) / 86_400_000));
}

/** Último fechamento de cada dia civil, no fuso pedido. */
async function loadDailyCloses(
  userId: Types.ObjectId,
  from: Date,
  to: Date,
  timeZone: string,
): Promise<DailyFollowerClose[]> {
  const rows = await AccountInsightModel.aggregate<{
    _id: string;
    followers: number;
    measuredAt: Date;
    readings: number;
  }>([
    {
      $match: {
        user: userId,
        recordedAt: { $gte: from, $lt: to },
        followersCount: { $type: "number" },
      },
    },
    { $sort: { recordedAt: 1 } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$recordedAt", timezone: timeZone } },
        followers: { $last: "$followersCount" },
        measuredAt: { $last: "$recordedAt" },
        readings: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).option({ maxTimeMS: 10_000 });

  return rows.map((row) => ({
    date: row._id,
    followers: row.followers,
    measuredAt: row.measuredAt,
    readings: row.readings,
  }));
}

/**
 * Fechamento mais recente **antes** do período, para que o primeiro dia da
 * janela também possa ter ganho. Sem ele, o primeiro dia sai com `netGain: null`.
 */
async function loadBaseline(
  userId: Types.ObjectId,
  before: Date,
  notOlderThan: Date,
  timeZone: string,
): Promise<DailyFollowerBaseline | null> {
  const row = await AccountInsightModel.findOne({
    user: userId,
    recordedAt: { $lt: before, $gte: notOlderThan },
    followersCount: { $type: "number" },
  })
    .sort({ recordedAt: -1 })
    .select("followersCount recordedAt")
    .lean<{ followersCount: number; recordedAt: Date } | null>();

  if (!row) return null;
  return {
    followers: row.followersCount,
    measuredAt: row.recordedAt,
    // O dia civil da referência importa: se ela é de cinco dias atrás, a primeira
    // variação cobre cinco dias e precisa dizer isso.
    date: civilDate(row.recordedAt, timeZone),
  };
}

/**
 * A conta em si, separada do banco: recebe os fechamentos já lidos e devolve a
 * série. É aqui que moram as decisões de honestidade, e é isto que os testes
 * exercitam sem precisar de Mongo.
 */
export function buildDailyFollowerGrowth(params: {
  startDate: string;
  endDate: string;
  timeZone: string;
  closes: DailyFollowerClose[];
  baseline: DailyFollowerBaseline | null;
  /** Dia civil de hoje no fuso pedido; o dia em curso não fecha. */
  today?: string;
}): DailyFollowerGrowth {
  const { closes, baseline } = params;
  const days: DailyFollowerPoint[] = [];
  let previousFollowers = baseline?.followers ?? null;
  let previousDate: string | null = baseline?.date ?? null;
  let transitions = 0;
  let gapTransitions = 0;

  for (const close of closes) {
    const hasPrevious = previousFollowers !== null && previousDate !== null;
    const daysCovered = hasPrevious ? daysApart(previousDate!, close.date) : null;
    const netGain = hasPrevious ? close.followers - previousFollowers! : null;
    if (netGain !== null) {
      transitions += 1;
      if ((daysCovered ?? 1) > 1) gapTransitions += 1;
    }
    days.push({
      date: close.date,
      followersAtEndOfDay: close.followers,
      netGain,
      daysCovered,
      readings: close.readings,
      measuredAt: close.measuredAt.toISOString(),
      dayIsComplete: close.date !== params.today,
    });
    previousFollowers = close.followers;
    previousDate = close.date;
  }

  const measured = days.filter((day) => day.netGain !== null);
  const gains = measured.map((day) => day.netGain!);
  // Melhor e pior dia só entre dias fechados: comparar meio dia com dias
  // inteiros elegeria o dia de hoje como o pior quase toda manhã.
  const complete = measured.filter((day) => day.dayIsComplete);
  const best = complete.reduce<DailyFollowerPoint | null>(
    (acc, day) => (!acc || day.netGain! > acc.netGain! ? day : acc),
    null,
  );
  const worst = complete.reduce<DailyFollowerPoint | null>(
    (acc, day) => (!acc || day.netGain! < acc.netGain! ? day : acc),
    null,
  );
  const followersAtEnd = days.at(-1)?.followersAtEndOfDay ?? null;
  // Sem referência anterior ao período, não existe "seguidores no início": o
  // primeiro número que temos já é o fechamento do primeiro dia medido.
  const followersAtStart = baseline?.followers ?? null;

  const inProgress = days.find((day) => !day.dayIsComplete) ?? null;
  const calendarDays = calendarDaysBetween(params.startDate, params.endDate);
  const warnings: string[] = [];
  if (inProgress) warnings.push("last_day_still_in_progress");
  if (!days.length) warnings.push("no_follower_readings_in_period");
  if (!baseline && days.length) warnings.push("first_day_has_no_prior_reading");
  if (gapTransitions > 0) warnings.push("collection_gaps_span_multiple_days");
  if (days.length && days.length < calendarDays) warnings.push("partial_daily_coverage");

  return {
    schemaVersion: DAILY_FOLLOWER_GROWTH_SCHEMA_VERSION,
    period: { startDate: params.startDate, endDate: params.endDate, timeZone: params.timeZone },
    days,
    summary: {
      netGain: gains.length ? gains.reduce((total, value) => total + value, 0) : null,
      followersAtStart,
      followersAtEnd,
      averageGainPerMeasuredDay: gains.length
        ? gains.reduce((total, value) => total + value, 0) / gains.length
        : null,
      bestDay: best ? { date: best.date, netGain: best.netGain! } : null,
      worstDay: worst ? { date: worst.date, netGain: worst.netGain! } : null,
      inProgressDay: inProgress ? { date: inProgress.date, netGain: inProgress.netGain } : null,
      daysWithLoss: complete.filter((day) => day.netGain! < 0).length,
    },
    coverage: {
      calendarDays,
      daysWithReading: days.length,
      measuredDayToDayTransitions: transitions,
      transitionsSpanningGaps: gapTransitions,
      hasBaselineBeforePeriod: Boolean(baseline),
      firstReadingAt: days[0]?.measuredAt ?? null,
      lastReadingAt: days.at(-1)?.measuredAt ?? null,
      warnings,
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "account_followers_snapshot_difference",
      gainIsDerivedNotReportedByInstagram: true,
      gainIsNetOfUnfollows: true,
      gapsAreNotSpreadAcrossDays: true,
      noPaidModelCalls: true,
      notes: [
        "Ganho do dia é a diferença entre o total de seguidores de dois fechamentos, não um número informado pelo Instagram.",
        "O ganho é líquido: quem seguiu menos quem deixou de seguir. Dia negativo significa saldo negativo, não falha de coleta.",
        "Dia sem leitura não aparece como zero; a variação seguinte declara quantos dias cobre em daysCovered.",
        "O total de seguidores do Instagram é arredondado em contas grandes, então variações de poucas unidades podem ser ruído.",
        "Sem leitura anterior ao período, o primeiro dia fica sem ganho — ausência de referência, não ausência de crescimento.",
        "O dia em curso tem dayIsComplete=false: o saldo dele ainda vai subir e não entra em melhor/pior dia nem na contagem de dias negativos.",
      ],
    },
  };
}

export async function getDailyFollowerGrowth(params: {
  userId: string;
  /** Início inclusivo, já convertido do dia civil para instante UTC. */
  startInclusive: Date;
  /** Fim exclusivo, já convertido do dia civil seguinte para instante UTC. */
  endExclusive: Date;
  startDate: string;
  endDate: string;
  timeZone: string;
  /** Até quantos dias antes do período procurar uma referência. */
  baselineLookbackDays?: number;
}): Promise<DailyFollowerGrowth> {
  const userId = new Types.ObjectId(params.userId);
  const baselineLookbackDays = Math.min(90, Math.max(1, params.baselineLookbackDays ?? 30));
  await connectToDatabase();

  const [closes, baseline] = await Promise.all([
    loadDailyCloses(userId, params.startInclusive, params.endExclusive, params.timeZone),
    loadBaseline(
      userId,
      params.startInclusive,
      new Date(params.startInclusive.getTime() - baselineLookbackDays * 86_400_000),
      params.timeZone,
    ),
  ]);

  return buildDailyFollowerGrowth({
    startDate: params.startDate,
    endDate: params.endDate,
    timeZone: params.timeZone,
    closes,
    baseline,
    today: civilDate(new Date(), params.timeZone),
  });
}
