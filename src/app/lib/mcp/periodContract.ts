import {
  lastClosedWeek,
  REPORT_TIMEZONE,
  shiftWeeks,
  weekWindowFor,
} from "@/app/lib/relatorio/weekWindow";

export const MCP_PERIOD_PRESETS = [
  "rolling_7_days",
  "last_closed_week",
  "current_week",
  "rolling_30_days",
  "previous_calendar_month",
  "custom",
] as const;

export type McpPeriodPreset = (typeof MCP_PERIOD_PRESETS)[number];

export interface McpPeriodRequest {
  periodPreset?: McpPeriodPreset;
  /** Compatibilidade com clientes v0.3: janela móvel exata em dias. */
  periodDays?: number;
  startsAt?: string;
  endsAt?: string;
}

export interface ResolvedMcpPeriod {
  preset: McpPeriodPreset | "legacy_rolling_days";
  kind: "rolling" | "calendar" | "custom";
  label: string;
  meaning: string;
  startsAt: Date;
  endsAt: Date;
  comparisonStartsAt: Date;
  comparisonEndsAt: Date;
  timezone: string;
  isClosed: boolean;
  days: number;
  legacyPeriodDays: number | null;
}

const DAY_MS = 86_400_000;
const MAX_PERIOD_DAYS = 365;

function timezoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour") % 24,
    read("minute"),
    read("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

function zonedWallTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let instant = new Date(naive - timezoneOffsetMinutes(new Date(naive), timeZone) * 60_000);
  instant = new Date(naive - timezoneOffsetMinutes(instant, timeZone) * 60_000);
  return instant;
}

function zonedDateParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: read("year"), month: read("month"), day: read("day") };
}

function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function rangeLabel(startsAt: Date, endsAt: Date, timeZone: string): string {
  return `${formatDate(startsAt, timeZone)} a ${formatDate(endsAt, timeZone)}`;
}

function previousEquivalent(startsAt: Date, endsAt: Date) {
  const duration = endsAt.getTime() - startsAt.getTime() + 1;
  const comparisonEndsAt = new Date(startsAt.getTime() - 1);
  return {
    comparisonStartsAt: new Date(comparisonEndsAt.getTime() - duration + 1),
    comparisonEndsAt,
  };
}

function parseCustomBoundary(value: string | undefined, boundary: "start" | "end", timeZone: string): Date {
  if (!value) throw new Error(`custom_period_${boundary}_required`);
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return zonedWallTimeToInstant(
      Number(year),
      Number(month),
      Number(day),
      boundary === "start" ? 0 : 23,
      boundary === "start" ? 0 : 59,
      boundary === "start" ? 0 : 59,
      boundary === "start" ? 0 : 999,
      timeZone,
    );
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`custom_period_${boundary}_invalid`);
  return parsed;
}

function result(params: Omit<ResolvedMcpPeriod, "days">): ResolvedMcpPeriod {
  const days = Math.max(1, Math.ceil((params.endsAt.getTime() - params.startsAt.getTime()) / DAY_MS));
  if (days > MAX_PERIOD_DAYS) throw new Error("period_exceeds_365_days");
  return { ...params, days };
}

export function resolveMcpPeriod(
  request: McpPeriodRequest = {},
  now: Date = new Date(),
  timeZone: string = REPORT_TIMEZONE,
): ResolvedMcpPeriod {
  const requestedPreset = request.periodPreset;

  if (requestedPreset === "custom") {
    const startsAt = parseCustomBoundary(request.startsAt, "start", timeZone);
    const requestedEnd = parseCustomBoundary(request.endsAt, "end", timeZone);
    const endsAt = requestedEnd > now ? now : requestedEnd;
    if (startsAt > endsAt) throw new Error("custom_period_start_after_end");
    return result({
      preset: "custom",
      kind: "custom",
      label: rangeLabel(startsAt, endsAt, timeZone),
      meaning: "intervalo personalizado solicitado pelo usuário",
      startsAt,
      endsAt,
      ...previousEquivalent(startsAt, endsAt),
      timezone: timeZone,
      isClosed: requestedEnd <= now,
      legacyPeriodDays: null,
    });
  }

  if (requestedPreset === "last_closed_week") {
    const week = lastClosedWeek(now, timeZone);
    const previous = shiftWeeks(week, 1, timeZone);
    return result({
      preset: requestedPreset,
      kind: "calendar",
      label: week.rangeLabel,
      meaning: "última semana completa, de segunda-feira a domingo",
      startsAt: week.startsAt,
      endsAt: week.endsAt,
      comparisonStartsAt: previous.startsAt,
      comparisonEndsAt: previous.endsAt,
      timezone: timeZone,
      isClosed: true,
      legacyPeriodDays: null,
    });
  }

  if (requestedPreset === "current_week") {
    const week = weekWindowFor(now, timeZone);
    const previous = shiftWeeks(week, 1, timeZone);
    const elapsed = now.getTime() - week.startsAt.getTime();
    return result({
      preset: requestedPreset,
      kind: "calendar",
      label: `${formatDate(week.startsAt, timeZone)} até agora`,
      meaning: "semana atual, de segunda-feira até o momento da análise",
      startsAt: week.startsAt,
      endsAt: now,
      comparisonStartsAt: previous.startsAt,
      comparisonEndsAt: new Date(Math.min(previous.endsAt.getTime(), previous.startsAt.getTime() + elapsed)),
      timezone: timeZone,
      isClosed: false,
      legacyPeriodDays: null,
    });
  }

  if (requestedPreset === "previous_calendar_month") {
    const current = zonedDateParts(now, timeZone);
    const currentMonthStart = zonedWallTimeToInstant(current.year, current.month, 1, 0, 0, 0, 0, timeZone);
    const previousMonthWall = new Date(Date.UTC(current.year, current.month - 2, 1));
    const previousMonthStart = zonedWallTimeToInstant(
      previousMonthWall.getUTCFullYear(),
      previousMonthWall.getUTCMonth() + 1,
      1, 0, 0, 0, 0, timeZone,
    );
    const comparisonMonthWall = new Date(Date.UTC(current.year, current.month - 3, 1));
    const comparisonStartsAt = zonedWallTimeToInstant(
      comparisonMonthWall.getUTCFullYear(),
      comparisonMonthWall.getUTCMonth() + 1,
      1, 0, 0, 0, 0, timeZone,
    );
    return result({
      preset: requestedPreset,
      kind: "calendar",
      label: new Intl.DateTimeFormat("pt-BR", { timeZone, month: "long", year: "numeric" })
        .format(previousMonthStart),
      meaning: "mês civil anterior completo",
      startsAt: previousMonthStart,
      endsAt: new Date(currentMonthStart.getTime() - 1),
      comparisonStartsAt,
      comparisonEndsAt: new Date(previousMonthStart.getTime() - 1),
      timezone: timeZone,
      isClosed: true,
      legacyPeriodDays: null,
    });
  }

  const defaultDays = requestedPreset === "rolling_7_days" ? 7 : 30;
  const hasLegacyDays = requestedPreset == null && request.periodDays != null;
  const legacyDays = Math.min(MAX_PERIOD_DAYS, Math.max(7, Math.trunc(request.periodDays ?? defaultDays)));
  const days = hasLegacyDays ? legacyDays : defaultDays;
  const startsAt = new Date(now.getTime() - days * DAY_MS);
  const preset = hasLegacyDays
    ? "legacy_rolling_days"
    : requestedPreset === "rolling_7_days"
      ? "rolling_7_days"
      : "rolling_30_days";
  return result({
    preset,
    kind: "rolling",
    label: `últimos ${days} dias até o momento da análise`,
    meaning: `${days} períodos exatos de 24 horas; não é uma semana ou mês civil`,
    startsAt,
    endsAt: now,
    ...previousEquivalent(startsAt, now),
    timezone: timeZone,
    isClosed: false,
    legacyPeriodDays: hasLegacyDays ? legacyDays : null,
  });
}
