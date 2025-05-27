// @/app/lib/fallbackInsightService/utils/mapDayNumberToText.ts

/**
 * Mapeia um número de dia (1-3) para seu equivalente textual ordinal.
 * @param dayNumber O número do dia.
 * @returns A representação textual do dia ou o número com 'º'.
 */
export function mapDayNumberToText(dayNumber?: number): string {
    if (dayNumber === 1) return "primeiro";
    if (dayNumber === 2) return "segundo";
    if (dayNumber === 3) return "terceiro";
    return dayNumber ? `${dayNumber}º` : "primeiro"; // Comportamento original para undefined/outros
}
