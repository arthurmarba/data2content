/**
 * weekWindow.ts — as janelas de tempo do relatório.
 *
 * A SEMANA é a unidade de entrega: o relatório sai toda segunda e fala da semana que
 * fechou no domingo. A JANELA é a unidade de comparação: 90 dias.
 *
 * Por que as duas: com ~140 posts por semana na base real, um ranking calculado só
 * sobre 7 dias tem células de n=1 ou n=2 — e aí "2,7×" não é um achado, é ruído. A
 * saída não é abandonar a semana, é separar o que cada janela responde:
 *
 *   • o NÚMERO da linha e as ocorrências → a semana (é isso que a reunião comenta)
 *   • o DIREITO de a linha existir       → a janela (elemento com histórico)
 *   • a MÉDIA que a risca do 1,0× marca  → a janela (base estável)
 *
 * Assim a tabela enche, o veredito continua sendo da semana, e nenhuma precisão é
 * inventada. Tudo em America/Sao_Paulo: a semana do criador brasileiro fecha no
 * domingo à meia-noite do fuso dele, não em UTC.
 */

export const REPORT_TIMEZONE = "America/Sao_Paulo";

/** Janela de elegibilidade e de linha de base. */
export const WINDOW_DAYS = 90;

/** Quantas semanas atrás a coluna de movimento compara. O mock usa 3. */
export const MOVEMENT_WEEKS_BACK = 3;

export interface WeekWindow {
  /** "2026-W30" */
  weekKey: string;
  isoYear: number;
  isoWeek: number;
  /** Segunda-feira 00:00:00.000 no fuso do relatório, como instante UTC. */
  startsAt: Date;
  /** Domingo 23:59:59.999 no fuso do relatório, como instante UTC. */
  endsAt: Date;
  /** Início da janela de 90 dias que termina junto com a semana. */
  windowStartsAt: Date;
  /** "20 a 26 de julho" */
  rangeLabel: string;
}

const MS_DAY = 86_400_000;

/**
 * Deslocamento do fuso, em minutos, para um instante. Positivo a leste de Greenwich.
 * Usa Intl em vez de tabela fixa para acompanhar mudança de horário de verão sem
 * precisar de date-fns-tz (que não está no projeto).
 */
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

  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
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

/** Converte "parede do relógio no fuso" para o instante UTC correspondente. */
function zonedWallTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  // Duas passadas: a primeira estimativa pode cair do lado errado de uma virada de DST.
  let instant = new Date(naive - timezoneOffsetMinutes(new Date(naive), timeZone) * 60_000);
  instant = new Date(naive - timezoneOffsetMinutes(instant, timeZone) * 60_000);
  return instant;
}

/** Data no fuso do relatório, decomposta. */
function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: read("year"), month: read("month"), day: read("day") };
}

/** Dia da semana ISO no fuso: 1 = segunda … 7 = domingo. */
function isoWeekdayInZone(instant: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const index = order.indexOf(name);
  return index >= 0 ? index + 1 : 1;
}

/** Ano e número da semana ISO 8601 de uma data-parede. */
function isoYearWeek(year: number, month: number, day: number): { isoYear: number; isoWeek: number } {
  // Algoritmo padrão ISO: a quinta-feira da semana define o ano.
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() + 4 - dayOfWeek);
  const isoYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((utc.getTime() - yearStart.getTime()) / MS_DAY + 1) / 7);
  return { isoYear, isoWeek };
}

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "20 a 26 de julho" · "29 de junho a 5 de julho" quando cruza o mês. */
function formatRangeLabel(startsAt: Date, endsAt: Date, timeZone: string): string {
  const start = zonedParts(startsAt, timeZone);
  const end = zonedParts(endsAt, timeZone);
  const startMonth = MONTHS_PT[start.month - 1];
  const endMonth = MONTHS_PT[end.month - 1];
  if (start.month === end.month) return `${start.day} a ${end.day} de ${endMonth}`;
  return `${start.day} de ${startMonth} a ${end.day} de ${endMonth}`;
}

/**
 * A semana ISO que contém `reference`. Segunda 00:00 → domingo 23:59:59.999 no fuso
 * do relatório.
 */
export function weekWindowFor(reference: Date, timeZone: string = REPORT_TIMEZONE): WeekWindow {
  const weekday = isoWeekdayInZone(reference, timeZone);
  // Recua para a segunda-feira usando a data-parede, não aritmética de UTC — o dia
  // pode ter 23 ou 25 horas na virada do horário de verão.
  const mondayGuess = new Date(reference.getTime() - (weekday - 1) * MS_DAY);
  const monday = zonedParts(mondayGuess, timeZone);

  const startsAt = zonedWallTimeToInstant(
    monday.year, monday.month, monday.day, 0, 0, 0, 0, timeZone,
  );
  const sundayGuess = new Date(startsAt.getTime() + 6 * MS_DAY + MS_DAY / 2);
  const sunday = zonedParts(sundayGuess, timeZone);
  const endsAt = zonedWallTimeToInstant(
    sunday.year, sunday.month, sunday.day, 23, 59, 59, 999, timeZone,
  );

  const { isoYear, isoWeek } = isoYearWeek(monday.year, monday.month, monday.day);
  const windowStartsAt = new Date(endsAt.getTime() - WINDOW_DAYS * MS_DAY);

  return {
    weekKey: `${isoYear}-W${String(isoWeek).padStart(2, "0")}`,
    isoYear,
    isoWeek,
    startsAt,
    endsAt,
    windowStartsAt,
    rangeLabel: formatRangeLabel(startsAt, endsAt, timeZone),
  };
}

/** A última semana FECHADA em relação a `reference`. É a semana do relatório da segunda. */
export function lastClosedWeek(
  reference: Date = new Date(),
  timeZone: string = REPORT_TIMEZONE,
): WeekWindow {
  const current = weekWindowFor(reference, timeZone);
  return weekWindowFor(new Date(current.startsAt.getTime() - MS_DAY), timeZone);
}

/** N semanas antes de uma semana. `shiftWeeks(w, 1)` = a semana anterior. */
export function shiftWeeks(
  week: WeekWindow,
  weeksBack: number,
  timeZone: string = REPORT_TIMEZONE,
): WeekWindow {
  return weekWindowFor(new Date(week.startsAt.getTime() - weeksBack * 7 * MS_DAY), timeZone);
}

/** Chave da semana N semanas atrás, sem materializar a janela toda. */
export function weekKeyBack(week: WeekWindow, weeksBack: number): string {
  return shiftWeeks(week, weeksBack).weekKey;
}

/**
 * Dia da semana (0 = domingo, como o slide desenha) e faixa de 4h de um instante,
 * lidos no fuso do relatório. Base da grade dia × horário.
 */
export function gridPosition(
  instant: Date,
  timeZone: string = REPORT_TIMEZONE,
): { dayOfWeek: number; slot: number } {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOfWeek = Math.max(0, order.indexOf(weekday));
  const hour =
    Number(
      new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(instant),
    ) % 24;
  return { dayOfWeek, slot: Math.floor(hour / 4) };
}

/** Rótulos das 6 faixas, na ordem em que aparecem no slide. */
export const SLOT_LABELS = ["0–4h", "4–8h", "8–12h", "12–16h", "16–20h", "20–24h"] as const;

export const WEEKDAY_LABELS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
