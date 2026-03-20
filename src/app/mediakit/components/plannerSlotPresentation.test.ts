import { getPlannerSlotPresentation } from './plannerSlotPresentation';

describe('getPlannerSlotPresentation', () => {
  it('prioriza a leitura V2/V2.5 quando o slot já traz campos estratégicos', () => {
    const presentation = getPlannerSlotPresentation({
      format: 'reel',
      categories: {
        context: ['technology_digital'],
        proposal: ['tips'],
        tone: 'educational',
        reference: ['city'],
      },
      contentIntent: ['teach'],
      narrativeForm: ['tutorial'],
      proofStyle: ['demonstration'],
      commercialMode: ['lead_capture'],
      stance: ['endorsing'],
      contentSignals: ['save_cta'],
    });

    expect(presentation.formatLabel).toBe('Reel');
    expect(presentation.intentLabel).toBe('Ensinar');
    expect(presentation.narrativeLabel).toBe('Tutorial/Passo a Passo');
    expect(presentation.contextLabel).toBe('Tecnologia/Digital');
    expect(presentation.focusDetailLabel).toBe('Prova');
    expect(presentation.focusDetailValue).toBe('Demonstracao');
    expect(presentation.metaChips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Comercial', value: 'Captura de Lead' }),
        expect.objectContaining({ label: 'Postura', value: 'Endossando' }),
        expect.objectContaining({ label: 'Sinal', value: 'CTA de Salvamento' }),
      ])
    );
  });

  it('deriva intenção e narrativa a partir do legado quando necessário', () => {
    const presentation = getPlannerSlotPresentation({
      format: 'carousel',
      title: '3 ideias para organizar sua rotina',
      categories: {
        context: ['personal_development'],
        proposal: ['tips'],
        tone: 'educational',
      },
    });

    expect(presentation.intentLabel).toBe('Ensinar');
    expect(presentation.narrativeLabel).toBe('Tutorial/Passo a Passo');
    expect(presentation.contextLabel).toBe('Desenvolvimento Pessoal');
    expect(presentation.focusDetailLabel).toBe('Tom');
    expect(presentation.focusDetailValue).toBe('Educacional/Informativo');
  });
});
