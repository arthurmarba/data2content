import { getMetricStrategicPresentation } from './metricStrategicPresentation';

describe('getMetricStrategicPresentation', () => {
  it('prioriza V2/V2.5 quando esses campos já existem', () => {
    const presentation = getMetricStrategicPresentation({
      format: ['reel'],
      context: ['technology_digital'],
      contentIntent: ['convert'],
      narrativeForm: ['review'],
      contentSignals: ['promo_offer'],
      stance: ['endorsing'],
      proofStyle: ['demonstration'],
      commercialMode: ['paid_partnership'],
    });

    expect(presentation.primaryGroupingLabel).toBe('Converter');
    expect(presentation.narrativeLabels).toEqual(['Review']);
    expect(presentation.proofLabels).toEqual(['Demonstracao']);
    expect(presentation.commercialLabels).toEqual(['Parceria Paga']);
  });

  it('deriva leitura estratégica do legado quando necessário', () => {
    const presentation = getMetricStrategicPresentation({
      description: 'Passo a passo com 3 dicas para organizar sua rotina.',
      format: ['carousel'],
      proposal: ['tips'],
      context: ['personal_development'],
      tone: ['educational'],
    });

    expect(presentation.primaryGroupingLabel).toBe('Ensinar');
    expect(presentation.narrativeLabels).toEqual(['Tutorial/Passo a Passo']);
    expect(presentation.contextLabels).toEqual(['Desenvolvimento Pessoal']);
  });
});
