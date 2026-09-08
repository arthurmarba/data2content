import { chooseComparisonMetric, evaluateConsistency, rankScore } from './evidencePolicy';
import type { CreatorWeeklyReportMetricInput } from './engine';

const now = new Date('2026-09-08T12:00:00Z');
const post = (id: number, shares: number, extra: Partial<CreatorWeeklyReportMetricInput> = {}): CreatorWeeklyReportMetricInput => ({
  _id: String(id), type: 'REEL', postDate: ['2026-08-18', '2026-08-25', '2026-09-01'][id % 3]!,
  stats: { shares }, d7Stats: { shares }, sceneElements: { version: 'v1' }, ...extra,
});

describe('política candidata de evidência', () => {
  it('não mistura a métrica ausente com zero nem escolhe referência zero', () => {
    expect(chooseComparisonMetric([post(1, 0), post(2, 0)])).toBeNull();
    expect(chooseComparisonMetric([post(1, 1), post(2, 1, { stats: {} })])).toBeNull();
    expect(chooseComparisonMetric([post(1, 0, { stats: { saved: 2 } }), post(2, 0, { stats: { saved: 3 } })])).toBe('saved');
  });

  const group = Array.from({ length: 6 }, (_, id) => post(id, 1.3));
  const reference = [...group, ...Array.from({ length: 15 }, (_, id) => post(id + 6, 1))];

  it('reconhece apenas como candidato um sinal distribuído e com D7 suficiente', () => {
    expect(evaluateConsistency(group, reference, now, true)).toBe(true);
    expect(evaluateConsistency(group.slice(0, 3), reference, now, true)).toBe(false);
  });

  it('não transforma números acumulados ou cobertura incompleta em consistência', () => {
    expect(evaluateConsistency(group, reference.map(row => ({ ...row, d7Stats: null })), now, true)).toBe(false);
    expect(evaluateConsistency(group, reference.map((row, index) => ({ ...row, sceneElements: index < 6 ? row.sceneElements : null })), now, true)).toBe(false);
  });

  it('rejeita viral isolado e ganho de apenas 1%', () => {
    const viral = group.map((row, index) => ({ ...row, d7Stats: { shares: index === 0 ? 100 : 0.9 } }));
    expect(evaluateConsistency(viral, reference, now, true)).toBe(false);
    expect(evaluateConsistency(group.map(row => ({ ...row, d7Stats: { shares: 1.01 } })), reference, now, true)).toBe(false);
    expect(rankScore(2, 1)).toBeLessThan(rankScore(2, 6));
  });

  it('não usa fotos e carrosséis como referência intercambiável', () => {
    const images = group.map(row => ({ ...row, type: 'IMAGE' }));
    const mixed = [...images, ...reference.slice(6).map(row => ({ ...row, type: 'CAROUSEL_ALBUM' }))];
    expect(evaluateConsistency(images, mixed, now, true)).toBe(false);
  });

  it('rebaixa um sinal que depende de uma única semana', () => {
    const unstable = group.map((row, index) => ({ ...row, postDate: index < 3 ? '2026-09-01' : index < 5 ? '2026-08-25' : '2026-08-18', d7Stats: { shares: index < 3 ? 2 : index === 3 ? 1.1 : 0.9 } }));
    expect(evaluateConsistency(unstable, reference, now, true)).toBe(false);
  });
});
