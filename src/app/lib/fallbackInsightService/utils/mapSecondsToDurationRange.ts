// @/app/lib/fallbackInsightService/utils/mapSecondsToDurationRange.ts

/**
 * Mapeia uma duração em segundos para uma faixa de duração textual.
 * @param seconds A duração em segundos.
 * @returns A faixa de duração textual.
 */
export function mapSecondsToDurationRange(seconds?: number): string {
    if (typeof seconds !== 'number' || isNaN(seconds)) return "Desconhecido/Outro";
    if (seconds < 15) return "0-15s";
    if (seconds < 30) return "15-30s";
    if (seconds < 60) return "30-60s";
    return "60s+";
}
