/** @jest-environment node */

import {
  BRAND_NARRATIVE_REPORT_DISCLAIMER,
  buildPublicBrandNarrativeReportPresentation,
  buildReportContent,
  formatBrandReportMetricCompact,
  formatBrandReportMetricLong,
  getBrandReportEvidenceTags,
  mapMetricToEvidencePost,
  resolveBrandReportPublicUrl,
  serializePublicBrandNarrativeReport,
  summarizeEvidenceMetrics,
} from '@/app/lib/brands/brandNarrativeReportBuilder';

describe('brandNarrativeReportBuilder', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('cria conteúdo determinístico com disclaimer', () => {
    const content = buildReportContent({
      creatorName: 'Creator Teste',
      brandName: 'Adidas',
      pauta: {
        title: 'Preparação para meia maratona',
        description: 'Treino, rotina e bastidores da prova.',
        theme: 'corrida',
      },
      match: {
        brandId: 'brand-adidas',
        brandName: 'Adidas',
        slug: 'adidas',
        rationale: 'A marca combina com corrida e preparação.',
        insertionAngle: 'A marca pode entrar no kit de treino.',
        suggestedDeliverables: ['1 Reels narrativo', 'Stories de bastidores'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      evidencePosts: [],
      metricsSummary: summarizeEvidenceMetrics([], 0),
    });

    expect(content.headline).toBe('Relatório de match narrativo: Creator Teste + Adidas');
    expect(content.disclaimer).toBe(BRAND_NARRATIVE_REPORT_DISCLAIMER);
    expect(content.organicProof).toContain('Ainda não há volume suficiente de posts orgânicos relacionados');
  });

  it('gera tese comercial e copy específica para relatório de tecnologia', () => {
    const content = buildReportContent({
      creatorName: 'Lívia Linhares',
      brandName: 'Apple',
      pauta: {
        title: 'Quando você tenta relaxar e o celular toca',
        description: 'Pauta sobre rotina digital, notificações, descanso e tentativa de pausa.',
        theme: 'Estilo de Vida e Bem-Estar',
        keywords: ['relaxar', 'celular', 'notificações', 'foco'],
      },
      match: {
        brandId: 'brand-apple',
        brandName: 'Apple',
        slug: 'apple',
        category: ['tecnologia'],
        matchedSignals: ['rotina digital', 'notificações', 'foco', 'equilíbrio'],
        rationale: 'Apple combina com rotina digital.',
        insertionAngle: 'A marca pode entrar na organização da rotina digital.',
        suggestedDeliverables: ['1 Reels narrativo', 'Stories de bastidores'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      evidencePosts: [
        mapMetricToEvidencePost({
          _id: 'metric-tech',
          description: 'POV tentando relaxar mas o celular toca de novo',
          stats: { views: 11466767, total_interactions: 1060696 },
        }),
      ],
      metricsSummary: {
        postsAnalyzed: 80,
        evidenceCount: 6,
        totalViews: 11466767,
        totalInteractions: 1060696,
      },
    });

    expect(content.executiveSummary).toContain('Apple');
    expect(content.executiveSummary).toContain('foco');
    expect(content.executiveSummary).toContain('notificações');
    expect(content.executiveSummary).toContain('equilíbrio digital');
    expect(content.brandFit).toContain('notificações');
    expect(content.brandFit).toContain('recursos de foco');
    expect(content.brandFit).toContain('uso mais consciente da tecnologia');
    expect(content.campaignIdea).toContain('Um Reels em formato POV mostrando Lívia tentando relaxar');
    expect(content.campaignIdea).not.toContain('a creator');
    expect(content.campaignIdea).toContain('organização da rotina digital');
    expect(content.narrativeThesis).toContain('A oportunidade está em transformar');
    expect(content.suggestedExecution).toEqual([
      'Reels POV sobre interrupção digital e tentativa de pausa',
      'Stories mostrando bastidores da rotina digital',
      'Recorte curto com reflexão sobre notificações e foco',
      'Sequência de bastidores com uso cotidiano da tecnologia',
    ]);
    expect(content.organicProof).toContain('11,4 milhões de visualizações');
    expect(content.organicProof).toContain('1,06 milhão de interações');
    expect(content.creatorApproachMessage).toContain('Olá, equipe Apple.');
    expect(content.creatorApproachMessage).toContain('tese criativa, evidências de performance e sugestão de execução');
    expect(content.disclaimer).toBe(BRAND_NARRATIVE_REPORT_DISCLAIMER);
  });

  it('formata métricas em pt-BR para cards e texto corrido', () => {
    expect(formatBrandReportMetricCompact(80)).toBe('80');
    expect(formatBrandReportMetricCompact(6)).toBe('6');
    expect(formatBrandReportMetricCompact(11466767)).toBe('11,4M');
    expect(formatBrandReportMetricCompact(1060696)).toBe('1,06M');
    expect(formatBrandReportMetricLong(11466767)).toBe('11,4 milhões');
    expect(formatBrandReportMetricLong(1060696)).toBe('1,06 milhão');
  });

  it('gera apresentação estratégica para relatório público já salvo', () => {
    const presentation = buildPublicBrandNarrativeReportPresentation({
      brand: { brandName: 'Apple', category: ['tecnologia'] },
      creator: { name: 'Lívia Linhares' },
      pauta: {
        title: 'Quando você tenta relaxar e o celular toca',
        keywords: ['quando', 'você', 'tenta', 'celular', 'notificações', 'pessoa', 'deita'],
      },
      match: {
        matchedSignals: ['rotina digital', 'notificações', 'foco'],
        rationale: 'Texto antigo.',
        insertionAngle: 'A marca pode entrar com organização da rotina digital.',
        suggestedDeliverables: ['1 Reels narrativo'],
      },
      metricsSummary: {
        postsAnalyzed: 80,
        evidenceCount: 6,
        totalViews: 11466767,
        totalInteractions: 1060696,
      },
      evidencePosts: [],
      reportContent: {
        executiveSummary: 'Apple foi identificada como uma possibilidade de match narrativo.',
      },
    });

    expect(presentation.content.executiveSummary).toContain('foco');
    expect(presentation.content.executiveSummary).toContain('notificações');
    expect(presentation.content.executiveSummary).toContain('equilíbrio digital');
    expect(presentation.content.executiveSummary).toContain('tentar relaxar e o celular toca');
    expect(presentation.content.executiveSummary).not.toContain('foi identificada como uma possibilidade');
    expect(presentation.content.campaignIdea).toContain('Lívia tentando relaxar');
    expect(presentation.content.campaignIdea).not.toContain('a creator');
    expect(presentation.organicEntry).toContain('rotina de Lívia');
    expect(presentation.organicEntry).toContain('celular que tira a paz');
    expect(presentation.chips).toEqual(expect.arrayContaining(['celular', 'notificações', 'rotina digital', 'foco', 'relaxar', 'pausa', 'equilíbrio digital']));
    expect(presentation.chips).not.toEqual(expect.arrayContaining(['quando', 'você', 'tenta', 'pessoa', 'deita']));
    expect(presentation.metrics.totalViews).toBe('11,4M');
    expect(presentation.metrics.totalInteractions).toBe('1,06M');
  });

  it('infere tags de evidência sem LLM a partir de sinais e métricas', () => {
    const tags = getBrandReportEvidenceTags(
      {
        title: 'POV tentando relaxar mas o celular toca',
        totalInteractions: 25000,
      },
      ['rotina real', 'notificações']
    );

    expect(tags).toEqual(expect.arrayContaining(['Humor cotidiano', 'Rotina real', 'Relaxamento']));
  });

  it('mapeia evidências e calcula métricas resumidas', () => {
    const postA = mapMetricToEvidencePost({
      _id: 'metric-a',
      description: 'Treino de corrida para prova',
      postLink: 'https://instagram.com/p/a',
      coverUrl: 'https://cdn.test/a.jpg',
      postDate: new Date('2026-01-10T00:00:00Z'),
      format: ['reel'],
      stats: {
        views: 1000,
        reach: 800,
        likes: 100,
        comments: 10,
        shares: 5,
        saved: 12,
        total_interactions: 127,
      },
    });
    const postB = mapMetricToEvidencePost({
      _id: 'metric-b',
      description: 'Bastidores pós-prova',
      stats: {
        views: 500,
        reach: 450,
        total_interactions: 80,
      },
    });

    const summary = summarizeEvidenceMetrics([postA, postB], 10);

    expect(postA.coverUrl).toBe('https://cdn.test/a.jpg');
    expect(summary.postsAnalyzed).toBe(10);
    expect(summary.evidenceCount).toBe(2);
    expect(summary.totalViews).toBe(1500);
    expect(summary.totalInteractions).toBe(207);
    expect(summary.topViews).toBe(1000);
  });

  it('metricsSummary não gera NaN com evidências vazias ou métricas ausentes', () => {
    const summary = summarizeEvidenceMetrics([
      mapMetricToEvidencePost({
        _id: 'metric-empty',
        description: 'Post sem imagem e sem métricas',
        stats: {},
      }),
    ], 1);

    expect(Number.isNaN(summary.totalViews)).toBe(false);
    expect(Number.isNaN(summary.totalInteractions)).toBe(false);
    expect(Number.isNaN(summary.avgViews)).toBe(false);
    expect(Number.isNaN(summary.avgInteractions)).toBe(false);
    expect(summary.totalViews).toBe(0);
    expect(summary.totalInteractions).toBe(0);
  });

  it('evidência sem imagem é serializada com coverUrl nulo', () => {
    const post = mapMetricToEvidencePost({
      _id: 'metric-no-cover',
      description: 'Post sem cover',
      stats: { views: 10 },
    });

    expect(post.coverUrl).toBeNull();
    expect(post.title).toBe('Post sem cover');
  });

  it('serialização pública não expõe userId, decisionSnapshot ou ids internos', () => {
    const publicReport = serializePublicBrandNarrativeReport({
      _id: 'report-1',
      userId: 'private-user-id',
      decisionSnapshot: { private: true },
      publicSlug: 'br-test',
      status: 'active',
      brand: { brandId: 'private-brand-id', brandName: 'Nike', category: ['esporte'] },
      creator: { name: 'Creator' },
      pauta: { title: 'Pauta' },
      match: { rationale: 'r', insertionAngle: 'i', suggestedDeliverables: [], disclaimer: 'd' },
      evidencePosts: [{ id: 'private-metric-id', title: 'Post público', views: 10 }],
      metricsSummary: { postsAnalyzed: 0, evidenceCount: 0 },
      reportContent: {
        headline: 'h',
        executiveSummary: 'e',
        narrativeThesis: 'n',
        brandFit: 'b',
        organicProof: 'o',
        campaignIdea: 'c',
        suggestedExecution: [],
        creatorApproachMessage: 'm',
        disclaimer: BRAND_NARRATIVE_REPORT_DISCLAIMER,
      },
    }) as Record<string, unknown>;

    expect(publicReport.userId).toBeUndefined();
    expect(publicReport.decisionSnapshot).toBeUndefined();
    expect(publicReport.id).toBeUndefined();
    expect(publicReport.publicSlug).toBe('br-test');
    expect((publicReport.brand as Record<string, unknown>).brandId).toBeUndefined();
    expect(((publicReport.evidencePosts as Array<Record<string, unknown>>)[0] || {}).id).toBeUndefined();
  });

  it('publicUrl usa a origem da request quando disponível', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.data2content.com/';
    process.env.NEXTAUTH_URL = 'https://auth.data2content.com';

    expect(resolveBrandReportPublicUrl('br-test', 'http://localhost:3000')).toBe(
      'http://localhost:3000/brand-report/br-test'
    );
  });

  it('publicUrl usa base URL configurável quando não há origem de request', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.data2content.com/';
    process.env.NEXTAUTH_URL = 'https://auth.data2content.com';

    expect(resolveBrandReportPublicUrl('br-test')).toBe(
      'https://app.data2content.com/brand-report/br-test'
    );
  });
});
