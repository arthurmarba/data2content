import { weekWindowFor } from '@/app/lib/relatorio/weekWindow';
import type { CreatorWeeklyReportMetricInput } from './engine';
import { isVideo, hasScene } from './evolution';

export type ComparisonMetric = 'shares' | 'saved' | 'views';
export const CONSISTENT_MIN_POSTS = 6;
// A promoção pública aguarda os dois fechamentos do piloto. A decisão candidata
// fica no relatório para avaliação, sem transformar uma hipótese em certeza.
export const CONSISTENT_POLICY_VALIDATED = false;
export const formatCohort = (metric: CreatorWeeklyReportMetricInput) => isVideo(metric) ? 'video' : metric.type;

export function median(values: (number | null)[]): number | null {
  const sorted = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length === 0 ? null : sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function performanceValue(metric: CreatorWeeklyReportMetricInput, dimension: ComparisonMetric, d7 = false): number | null {
  const stats = d7 ? metric.d7Stats : metric.stats;
  const value = stats?.[dimension] ?? (dimension === 'views' ? stats?.video_views ?? stats?.impressions : null);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function chooseComparisonMetric(metrics: CreatorWeeklyReportMetricInput[], d7 = false): ComparisonMetric | null {
  for (const dimension of ['shares', 'saved', 'views'] as const) {
    const values = metrics.map(metric => performanceValue(metric, dimension, d7));
    if (values.filter(value => value !== null).length >= metrics.length * 0.8 && (median(values) ?? 0) > 0) return dimension;
  }
  return null;
}

export function rankScore(index: number | null, count: number): number {
  return index === null ? 0 : 1 + (index - 1) * count / (count + 5);
}

export function evaluateConsistency(group: CreatorWeeklyReportMetricInput[], reference: CreatorWeeklyReportMetricInput[], now: Date, sceneRequired: boolean | "opening"): boolean {
  if (group.length < CONSISTENT_MIN_POSTS || reference.length < 15) return false;
  // Não compara uma mistura de formatos como se o contexto fosse equivalente.
  if (new Set(group.map(formatCohort)).size !== 1) return false;
  const sameFormat = reference.filter(metric => formatCohort(metric) === formatCohort(group[0]!));
  if (sameFormat.length < 15) return false;
  const recent = sameFormat.filter(metric => now.getTime() - new Date(metric.postDate).getTime() <= 28 * 86_400_000);
  if (recent.length === 0 || (sceneRequired && recent.filter(hasScene).length / recent.length < 0.8)) return false;
  if (sceneRequired === 'opening' && recent.filter(metric => hasScene(metric) && typeof metric.sceneElements?.openingLine === 'string' && metric.sceneElements.openingLine.trim()).length / recent.length < 0.8) return false;
  if (group.filter(metric => metric.d7Stats).length / group.length < 0.8) return false;
  if (sameFormat.filter(metric => metric.d7Stats).length / sameFormat.length < 0.8) return false;
  const dimension = chooseComparisonMetric(sameFormat, true);
  if (!dimension) return false;
  const baseline = median(sameFormat.map(metric => performanceValue(metric, dimension, true)));
  if (!baseline || baseline <= 0) return false;
  const rows = group.flatMap(metric => {
    const value = performanceValue(metric, dimension, true);
    return value === null ? [] : [{ index: value / baseline, week: weekWindowFor(new Date(metric.postDate)).weekKey }];
  });
  const weeks = [...new Set(rows.map(row => row.week))];
  if (rows.length < 6 || weeks.length < 3 || (median(rows.map(row => row.index)) ?? 0) < 1.2) return false;
  if (rows.filter(row => row.index > 1).length / rows.length < 2 / 3) return false;
  // Retirar qualquer semana não pode inverter o sinal — critério mais conservador
  // que tentar adivinhar qual foi a semana de maior influência.
  return weeks.every(week => (median(rows.filter(row => row.week !== week).map(row => row.index)) ?? 0) > 1);
}
