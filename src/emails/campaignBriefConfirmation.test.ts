import { campaignBriefConfirmation } from './campaignBriefConfirmation';

describe('campaignBriefConfirmation', () => {
  it('monta resumo com segmentos e briefing', () => {
    const result = campaignBriefConfirmation({
      brandName: 'Magalu',
      budgetText: 'R$ 50.000,00',
      segments: ['Tech', 'Moda', 'Tech'],
      description: 'Queremos criadores para falar de novidades em tecnologia.\nTimeline de 45 dias.',
      originHandle: 'criadora.incrivel',
    });

    expect(result.subject).toBe('Recebemos seu briefing de campanha ✨');
    expect(result.text).toContain('Magalu');
    expect(result.text).toContain('R$ 50.000,00');
    expect(result.text).toContain('criadora.incrivel');
    expect(result.html).toContain('Magalu');
    expect(result.html).toContain('Tech, Moda');
    expect(result.html).toContain('Timeline de 45 dias.');
  });

  it('funciona com dados mínimos', () => {
    const result = campaignBriefConfirmation({
      brandName: 'Ambev',
    });

    expect(result.text).toContain('Ambev');
    expect(result.html).toContain('Ambev');
  });
});
