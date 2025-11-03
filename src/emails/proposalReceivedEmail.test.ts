import { proposalReceivedEmail } from './proposalReceivedEmail';

describe('proposalReceivedEmail', () => {
  it('gera assunto e conteúdo com briefing, entregáveis e link', () => {
    const result = proposalReceivedEmail({
      creatorName: 'Marina',
      creatorHandle: 'marina.creators',
      brandName: 'Natura',
      campaignTitle: 'Lançamento linha verão',
      budgetText: 'R$ 8.000,00',
      deliverables: ['3 Reels', 'Pacote de Stories'],
      briefing: 'Foco em cuidados com a pele.\nPrazo de 30 dias.',
      createdAt: new Date('2024-05-10T14:30:00Z'),
      proposalUrl: 'https://app.data2content.ai/dashboard/proposals/123',
    });

    expect(result.subject).toBe('Nova proposta recebida no seu Mídia Kit 🎯');
    expect(result.text).toContain('Marina');
    expect(result.text).toContain('Natura');
    expect(result.text).toContain('R$ 8.000,00');
    expect(result.text).toContain('Briefing: Foco em cuidados com a pele.');
    expect(result.text).toContain('https://app.data2content.ai/dashboard/proposals/123');
    expect(result.html).toContain('Lançamento linha verão');
    expect(result.html).toContain('Foco em cuidados com a pele.');
    expect(result.html).toContain('3 Reels');
    expect(result.html).toContain('Ver proposta na plataforma');
  });

  it('funciona sem orçamento ou briefing', () => {
    const result = proposalReceivedEmail({
      brandName: 'Ambev',
      proposalUrl: 'https://data2content.ai/dashboard/proposals/xyz',
    });

    expect(result.text).toContain('Ambev');
    expect(result.text).toContain('data2content.ai/dashboard/proposals/xyz');
    expect(result.html).toContain('Ambev');
  });
});
