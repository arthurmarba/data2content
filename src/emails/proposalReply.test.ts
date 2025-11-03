import { proposalReplyEmail } from './proposalReply';

describe('proposalReplyEmail', () => {
  it('monta subject e corpo com resumo da proposta', () => {
    const result = proposalReplyEmail({
      creatorName: 'Ana',
      creatorHandle: 'ana.creator',
      brandName: 'iFood',
      campaignTitle: 'Campanha Reels Outubro',
      emailBody: 'Oi time!\n\nVamos seguir com o plano sugerido.',
      budgetText: 'R$ 5.000,00',
      deliverables: ['3 Reels', '5 Stories'],
      receivedAt: new Date('2024-05-20T15:00:00Z'),
      mediaKitUrl: 'https://app.data2content.ai/mediakit/ana',
    });

    expect(result.subject).toContain('Campanha "Campanha Reels Outubro"');
    expect(result.subject).toContain('Ana');
    expect(result.text).toContain('Marca: iFood');
    expect(result.text).toContain('Orçamento: R$ 5.000,00');
    expect(result.text).toContain('3 Reels, 5 Stories');
    expect(result.text).toContain('@ana.creator | via Data2Content');
    expect(result.html).toContain('<ul');
    expect(result.html).toContain('Campanha Reels Outubro');
    expect(result.html).toContain('https://app.data2content.ai/mediakit/ana');
    expect(result.html).toContain('@ana.creator | via Data2Content');
  });

  it('remove espaços supérfluos e ainda gera assinatura', () => {
    const result = proposalReplyEmail({
      creatorName: null,
      brandName: 'Natura',
      emailBody: '\nOlá!\nSeguimos alinhados.\n',
    });

    expect(result.subject).toContain('Proposta Natura');
    expect(result.text.trim().startsWith('Olá!')).toBe(true);
    expect(result.text).toContain('via Data2Content');
    expect(result.html).toContain('via Data2Content');
  });
});
