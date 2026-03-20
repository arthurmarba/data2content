import {
  formatCommunityInspirationSubtitle,
  formatStrategicGroupingValue,
  getStrategicQuickStats,
} from '@/app/lib/strategicReportPresentation';
import type { StrategicReport } from 'types/StrategicReport';

describe('strategicReportPresentation', () => {
  it('formats V2 and V2.5 grouping values into user-facing labels', () => {
    expect(formatStrategicGroupingValue('contentIntent', 'convert')).toBe('Converter');
    expect(formatStrategicGroupingValue('narrativeForm', 'review')).toBe('Review');
    expect(formatStrategicGroupingValue('proofStyle', 'myth_busting')).toBe('Quebra de Mito');
    expect(formatStrategicGroupingValue('context', 'fashion_style')).toBe('Moda/Estilo');
  });

  it('builds quick stats and inspiration subtitles with strategic dimensions', () => {
    const report = {
      correlations: [
        {
          id: 'corr_time_comments',
          dimension: 'time',
          metric: 'comments',
          method: 'delta_vs_median',
          coeffOrDelta: 24.5,
          insightText: 'Quarta 19h acima da mediana por comentários',
          evidenceRefs: [],
        },
      ],
      evidence: {
        timeBuckets: [{ dayOfWeek: 4, hour: 19, avg: 1200, count: 12 }],
        groupingAverages: [
          { dimension: 'format', name: 'reel', value: 800, postsCount: 10 },
          { dimension: 'contentIntent', name: 'convert', value: 900, postsCount: 9 },
          { dimension: 'narrativeForm', name: 'review', value: 870, postsCount: 8 },
          { dimension: 'proofStyle', name: 'myth_busting', value: 860, postsCount: 7 },
        ],
      },
    } as StrategicReport;

    const quickStats = getStrategicQuickStats(report);
    expect(quickStats.map((item) => item.title)).toEqual(
      expect.arrayContaining(['Melhor horário (interações)', 'Melhor horário (comentários)', 'Top intenção', 'Top narrativa', 'Top prova'])
    );
    expect(quickStats.find((item) => item.key === 'top-content-intent')?.value).toBe('Converter');

    expect(
      formatCommunityInspirationSubtitle({
        id: '1',
        handleOrAnon: 'criador da comunidade',
        format: 'reel',
        contentIntent: 'convert',
        narrativeForm: 'review',
        context: 'fashion_style',
        whyItWorks: 'Alta resposta comercial.',
      })
    ).toBe('Reel · Converter · Review · Moda/Estilo');
  });
});
