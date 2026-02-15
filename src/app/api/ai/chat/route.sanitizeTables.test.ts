// @jest-environment node
jest.mock('@/app/lib/pricing/publiCalculator', () => ({
  __esModule: true,
  PRICING_MULTIPLIERS: {
    formato: { post: 1, reels: 1, stories: 1, pacote: 1 },
    exclusividade: { nenhuma: 1, '7d': 1, '15d': 1, '30d': 1, '90d': 1, '180d': 1, '365d': 1 },
    usoImagem: { organico: 1, midiapaga: 1, global: 1 },
    duracaoMidiaPaga: { nenhum: 1, '7d': 1, '15d': 1, '30d': 1, '90d': 1, '180d': 1, '365d': 1 },
    repostTikTok: { nao: 1, sim: 1 },
    brandSize: { pequena: 1, media: 1, grande: 1 },
    imageRisk: { baixo: 1, medio: 1, alto: 1 },
    strategicGain: { baixo: 1, medio: 1, alto: 1 },
    contentModel: { publicidade_perfil: 1, ugc_whitelabel: 1 },
    complexidade: { simples: 1, roteiro: 1, profissional: 1 },
    autoridade: { padrao: 1, ascensao: 1, autoridade: 1, celebridade: 1 },
    sazonalidade: { normal: 1, alta: 1, baixa: 1 },
  },
  runPubliCalculator: jest.fn(),
}));
jest.mock('@/app/lib/pricing/featureFlag', () => ({
  isPricingBrandRiskV1Enabled: jest.fn().mockResolvedValue(true),
  isPricingCalibrationV1Enabled: jest.fn().mockResolvedValue(true),
}));

import { enforceScriptContract, sanitizeTables } from './route';

describe('sanitizeTables', () => {
  it('preserva tabelas markdown completas', () => {
    const markdown = [
      'Introdução',
      '',
      '| Coluna A | Coluna B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '| 3 | 4 |',
      '',
      'Conclusão',
    ].join('\n');

    const result = sanitizeTables(markdown);
    expect(result).toContain('| Coluna A | Coluna B |');
    expect(result).toContain('| 3 | 4 |');
    expect(result).toContain('Conclusão');
  });
});

describe('enforceScriptContract', () => {
  it('reconstrói blocos de roteiro/legenda quando faltam tags', () => {
    const raw = [
      'Roteiro para vender curso',
      '- **Gancho:** Pare de perder vendas por falta de clareza.',
      '- **Desenvolvimento:** Mostre o erro comum e a correção em 2 passos.',
      '- **CTA:** Peça para salvar e compartilhar.',
    ].join('\n');

    const result = enforceScriptContract(raw, 'roteiro de vendas para reels');
    const sceneRows = result.normalized
      .split('\n')
      .filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('| Tempo |'));

    expect(result.normalized).toContain('[ROTEIRO]');
    expect(result.normalized).toContain('[/ROTEIRO]');
    expect(result.normalized).toContain('[LEGENDA]');
    expect(result.normalized).toContain('[/LEGENDA]');
    expect(sceneRows.length).toBeGreaterThanOrEqual(3);
    expect(result.repaired).toBe(true);
    expect(result.issues).toContain('missing_roteiro_block');
  });

  it('garante CTA e V1/V2/V3 na legenda', () => {
    const raw = [
      '[ROTEIRO]',
      '**Título Sugerido:** Teste',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Cena 1 | Fala 1 |',
      '| 03-15s | Cena 2 | Fala 2 |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'Texto único sem variações.',
      '[/LEGENDA]',
    ].join('\n');

    const result = enforceScriptContract(raw, 'roteiro para nicho fitness');

    expect(result.normalized).toMatch(/\|\s?(20|22)-30s\s?\|/);
    expect(result.normalized).toContain('V1:');
    expect(result.normalized).toContain('V2:');
    expect(result.normalized).toContain('V3:');
    expect(result.quality.hasCta).toBe(true);
  });

  it('injeta racional e metadata de inspiração quando houver hint', () => {
    const raw = [
      '[ROTEIRO]',
      '**Título Sugerido:** Teste',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Cena 1 | Fala 1 |',
      '| 03-15s | Cena 2 | Fala 2 |',
      '| 15-25s | Cena 3 | Fala 3 |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: Legenda base',
      '[/LEGENDA]',
    ].join('\n');

    const result = enforceScriptContract(raw, 'roteiro para lançamento', {
      inspiration: {
        title: 'Case de referência',
        postLink: 'https://www.instagram.com/reel/ABC123xyz/',
        reason: 'Match de proposta e narrativa.',
        supportingInspirations: [
          { role: 'gancho', title: 'Gancho 1', postLink: 'https://www.instagram.com/reel/GANCHO1/', reason: 'Abre com dor real.' },
          { role: 'desenvolvimento', title: 'Desenvolvimento 1', postLink: 'https://www.instagram.com/reel/DESENV1/', reason: 'Explica em 2 passos.' },
          { role: 'cta', title: 'CTA 1', postLink: 'https://www.instagram.com/reel/CTA1/', reason: 'Fecha com ação clara.' },
        ],
      },
    });

    expect(result.normalized).toContain('[INSPIRATION_JSON]');
    expect(result.normalized).toContain('"title": "Case de referência"');
    expect(result.normalized).toContain('"supportingInspirations"');
    expect(result.normalized).toContain('**Inspirações narrativas de apoio:**');
    expect(result.normalized).toContain('- Gancho: Gancho 1');
    expect(result.normalized).toContain('**Por que essa inspiração:** Match de proposta e narrativa.');
  });

  it('remove linhas separadoras inválidas da tabela de roteiro', () => {
    const raw = [
      '[ROTEIRO]',
      '**Título Sugerido:** Teste',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| --- | :--- | :--- |',
      '| 00-03s | Cena 1 | Fala 1 |',
      '| 03-20s | Cena 2 | Fala 2 |',
      '| 20-30s | Cena 3 | Salve e compartilhe |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: Legenda base',
      '[/LEGENDA]',
    ].join('\n');

    const result = enforceScriptContract(raw, 'crie um roteiro de conteúdo para que eu possa postar');
    expect(result.normalized).not.toContain('| --- | :--- | :--- |');
    expect(result.normalized).toContain('| 00-03s |');
  });

  it('evita título que apenas repete o pedido genérico do usuário', () => {
    const raw = [
      '[ROTEIRO]',
      '**Título Sugerido:** Crie um roteiro de conteúdo para que eu possa postar',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Cena 1 | Fala 1 |',
      '| 03-20s | Cena 2 | Fala 2 |',
      '| 20-30s | Cena 3 | Salve e compartilhe |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: Legenda base',
      '[/LEGENDA]',
    ].join('\n');

    const result = enforceScriptContract(raw, 'Crie um roteiro de conteúdo para que eu possa postar');
    expect(result.normalized).toContain('**Título Sugerido:** Roteiro curto de Reels (30 segundos)');
    expect(result.normalized).not.toContain('Crie um roteiro de conteúdo para que eu possa postar em 30 segundos');
  });
});
