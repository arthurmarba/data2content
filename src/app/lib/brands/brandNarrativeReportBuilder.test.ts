/** @jest-environment node */

import {
  BRAND_NARRATIVE_REPORT_DISCLAIMER,
  buildBrandNarrativeDeckPresentation,
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
    expect(content.narrativeFormula).toHaveLength(3);
    expect(content.campaignConcept).toBeTruthy();
    expect(content.activationPlan).toHaveLength(5);
    expect(content.brandRole).toContain('Adidas');
    expect(content.commercialClose).toContain('Essa proposta parte de uma narrativa orgânica');
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
    expect(content.narrativeFormula).toEqual([
      expect.objectContaining({ title: 'Conflito reconhecível' }),
      expect.objectContaining({ title: 'Desenvolvimento da situação' }),
      expect.objectContaining({ title: 'Entrada natural da marca' }),
    ]);
    expect(content.narrativeFormula?.[2]?.description).toContain('foco, notificações e equilíbrio digital');
    expect(content.evidenceReading).toContain('menor risco de parecer uma publicidade desconectada');
    expect(content.evidenceReading).toContain('11,4 milhões de visualizações');
    expect(content.campaignConcept).toBe('Quando a pausa encontra a tecnologia');
    expect(content.campaignIdea).toContain('Um Reels em formato POV mostrando Lívia tentando relaxar');
    expect(content.campaignIdea).not.toContain('a creator');
    expect(content.campaignIdea).toContain('organização da rotina digital');
    expect(content.brandRole).toContain('não precisa interromper a história');
    expect(content.activationPlan).toEqual([
      expect.objectContaining({ title: 'Stories de contexto' }),
      expect.objectContaining({ title: 'Reels principal' }),
      expect.objectContaining({ title: 'Entrada da marca' }),
      expect.objectContaining({ title: 'Stories de continuidade' }),
      expect.objectContaining({ title: 'Recorte pós-campanha' }),
    ]);
    expect(content.activationPlan?.[1]?.description).toContain('POV da pausa interrompida pelo celular');
    expect(content.activationPlan?.[2]?.description).toContain('foco, notificações e uso mais consciente');
    expect(content.commercialClose).toContain('menor risco de parecer uma publicidade desconectada');
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
    expect(content.creatorApproachMessage).toContain('tese criativa, evidências de performance e uma sugestão de ativação');
    expect(content.creatorApproachMessage).toContain('Posso enviar para vocês avaliarem?');
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
    expect(presentation.content.narrativeFormula).toHaveLength(3);
    expect(presentation.content.evidenceReading).toContain('rotina digital');
    expect(presentation.content.evidenceReading).toContain('menor risco de parecer uma publicidade desconectada');
    expect(presentation.content.campaignConcept).toBe('Quando a pausa encontra a tecnologia');
    expect(presentation.content.campaignIdea).toContain('Lívia tentando relaxar');
    expect(presentation.content.campaignIdea).not.toContain('a creator');
    expect(presentation.content.activationPlan?.[0]?.title).toBe('Stories de contexto');
    expect(presentation.content.activationPlan?.[2]?.title).toBe('Entrada da marca');
    expect(presentation.content.brandRole).toContain('celular e a tecnologia');
    expect(presentation.content.commercialClose).toContain('Apple entra em uma história reconhecível');
    expect(presentation.organicEntry).toContain('rotina de Lívia');
    expect(presentation.organicEntry).toContain('celular que tira a paz');
    expect(presentation.chips).toEqual(expect.arrayContaining(['relaxar', 'celular', 'notificações', 'foco', 'rotina digital', 'equilíbrio digital']));
    expect(presentation.chips).not.toEqual(expect.arrayContaining(['quando', 'você', 'tenta', 'pessoa', 'deita', 'toca', 'tocar', 'Tema-base', 'notificacao']));
    expect(presentation.metrics.totalViews).toBe('11,4M');
    expect(presentation.metrics.totalInteractions).toBe('1,06M');
  });

  it('gera camada deck derivada sem depender de novos campos no banco', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Apple', category: ['tecnologia'], subcategories: ['smartphones'] },
      creator: { name: 'Lívia Linhares' },
      pauta: {
        title: 'Quando você tenta relaxar e o celular toca',
        theme: 'Estilo de Vida e Bem-Estar',
        keywords: ['relaxar', 'celular', 'notificações'],
      },
      match: {
        matchedSignals: ['rotina digital', 'notificações', 'foco'],
        rationale: 'Apple combina com rotina digital.',
        insertionAngle: 'A marca pode entrar com organização da rotina digital.',
        suggestedDeliverables: ['1 Reels narrativo'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: {
        postsAnalyzed: 80,
        evidenceCount: 2,
        totalViews: 11466767,
        totalInteractions: 1060696,
      },
      evidencePosts: [
        {
          id: 'metric-tech',
          title: 'POV tentando relaxar mas o celular toca',
          description: 'POV tentando relaxar mas o celular toca de novo',
          postLink: 'https://instagram.com/p/test',
          coverUrl: 'https://cdn.test/cover.jpg',
          format: 'Reels',
          views: 11466767,
          totalInteractions: 1060696,
        },
      ],
      reportContent: {
        executiveSummary: 'Texto antigo que não deve ser obrigatório para o deck.',
      },
    });

    expect(deck.heroThesis.title).toBe('Apple dentro de uma narrativa já validada pela audiência de Lívia Linhares.');
    expect(deck.heroThesis.subtitle).toContain('a tentativa de relaxar enquanto o celular interrompe');
    expect(deck.heroThesis.subtitle).toContain('Apple entra de forma natural');
    expect(deck.heroThesis.disclaimer).toBe(BRAND_NARRATIVE_REPORT_DISCLAIMER);
    expect(deck.organicSeriesProof.summary).toContain('2 conteúdos orgânicos');
    expect(deck.organicSeriesProof.summary).toContain('11,4 milhões de visualizações');
    expect(deck.organicSeriesProof.metrics).toEqual(
      expect.arrayContaining([
        { label: 'Base analisada', value: '80' },
        { label: 'Evidências orgânicas', value: '2' },
        { label: 'Visualizações', value: '11,4M' },
        { label: 'Interações', value: '1,06M' },
      ])
    );
    expect(deck.narrativeFormulaTitle).toBe('Fórmula narrativa: Quando a pausa encontra a tecnologia');
    expect(deck.narrativeFormulaSteps).toHaveLength(3);
    expect(deck.evidenceStoryline).toHaveLength(1);
    expect(deck.evidenceStoryline[0]).toEqual(
      expect.objectContaining({
        role: 'Conexão',
        title: 'POV tentando relaxar mas o celular toca',
        reason: 'Esse conteúdo mostra que celular, notificações e foco já fazem parte do conflito narrativo que a audiência reconhece.',
        metricHighlight: '11,4M',
        metricLabel: 'visualizações',
        postLink: 'https://instagram.com/p/test',
        coverUrl: 'https://cdn.test/cover.jpg',
      })
    );
    expect(deck.evidenceStoryline[0]?.tags).toEqual(expect.arrayContaining(['Humor cotidiano', 'Relaxamento']));
    expect(deck.brandMatchMatrix).toHaveLength(3);
    expect(deck.brandMatchMatrix[1]?.brandRelevance).toContain('não de uma promessa de parceria ou campanha ativa');
    expect(deck.brandInsertionThesis.guardrail).toContain('não indica relação comercial');
    expect(deck.brandInsertionThesis.guardrail).toContain('campanha ativa');
    expect(deck.activationTimeline).toHaveLength(5);
    expect(deck.commercialRecap.disclaimer).toBe(BRAND_NARRATIVE_REPORT_DISCLAIMER);
    expect(deck.commercialRecap.title).toBe('Uma oportunidade pronta para conversa');
    expect(deck.commercialRecap.bullets.join(' ')).toContain('parceria confirmada');
    expect(deck.finalCta.title).toBe('Próximo passo');
    expect(deck.finalCta.body).toContain('conversa comercial mais objetiva');
    expect(deck.suggestedNextStep).toContain('hipótese criativa de ativação');
    expect(deck.approachMessageTitle).toBe('Mensagem sugerida para abordagem');
    expect(deck.approachMessageIntro).toContain('sem assumir parceria');
  });

  it('gera evidenceStoryline de tecnologia com papel narrativo, razão comercial e métrica principal', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Apple', category: ['tecnologia'] },
      creator: { name: 'Lívia Linhares' },
      pauta: {
        title: 'Quando você tenta relaxar e o celular toca',
        keywords: ['relaxar', 'celular', 'notificações'],
      },
      match: {
        matchedSignals: ['celular', 'notificações', 'foco'],
        rationale: 'Apple combina com rotina digital.',
        insertionAngle: 'A marca entra na organização da rotina digital.',
        suggestedDeliverables: ['1 Reels'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 12, evidenceCount: 1, totalViews: 11466767, totalInteractions: 1060696 },
      evidencePosts: [
        {
          id: 'metric-tech-1',
          title: 'Tentando relaxar mas o celular toca',
          description: 'POV tentando relaxar mas o celular toca de novo',
          views: 11466767,
          totalInteractions: 1060696,
        },
      ],
      reportContent: { executiveSummary: 'Resumo antigo.' },
    });

    expect(deck.evidenceStoryline[0]).toEqual(
      expect.objectContaining({
        role: 'Conexão',
        reason: 'Esse conteúdo mostra que celular, notificações e foco já fazem parte do conflito narrativo que a audiência reconhece.',
        metricHighlight: '11,4M',
        metricLabel: 'visualizações',
      })
    );
    expect(deck.evidenceStoryline[0]?.reason).not.toContain('Prova comportamental');
    expect(deck.evidenceStoryline[0]?.reason).not.toContain('Conteúdo orgânico selecionado');
  });

  it('gera evidenceStoryline de esporte/corrida como jornada narrativa', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Nike', category: ['esporte'] },
      creator: { name: 'O Pai que Corre' },
      pauta: {
        title: 'Preparação para meia maratona',
        theme: 'corrida',
        keywords: ['treino', 'prova', 'chegada'],
      },
      match: {
        matchedSignals: ['corrida', 'treino', 'meia maratona'],
        rationale: 'Nike combina com corrida e preparação.',
        insertionAngle: 'A marca pode entrar no contexto da preparação.',
        suggestedDeliverables: ['Reels de jornada'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 20, evidenceCount: 3, totalViews: 390000, totalInteractions: 42000 },
      evidencePosts: [
        { id: 'run-1', title: 'Treino antes da prova', description: 'Rotina de treino para corrida', views: 250000, totalInteractions: 22000 },
        { id: 'run-2', title: 'Deslocamento para a largada', description: 'Chegando para a meia maratona', views: 90000, totalInteractions: 12000 },
        { id: 'run-3', title: 'Chegada emocional', description: 'Final da prova e emoção da chegada', views: 50000, totalInteractions: 8000 },
      ],
      reportContent: { executiveSummary: 'Resumo antigo.' },
    });

    expect(deck.evidenceStoryline.map((item) => item.role)).toEqual(['Conexão', 'Conflito', 'Resolução']);
    expect(deck.evidenceStoryline[0]?.reason).toBe(
      'Esse conteúdo mostra que a audiência acompanha a jornada de esforço, deslocamento e chegada emocional.'
    );
    expect(deck.evidenceStoryline[0]?.metricHighlight).toBe('250 mil');
    expect(deck.evidenceStoryline[0]?.metricLabel).toBe('visualizações');
  });

  it('gera activationTimeline de tecnologia como campanha seriada', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Apple', category: ['tecnologia'] },
      creator: { name: 'Lívia Linhares' },
      pauta: { title: 'Quando você tenta relaxar e o celular toca', keywords: ['celular', 'notificações', 'foco'] },
      match: {
        matchedSignals: ['celular', 'notificações', 'foco'],
        rationale: 'Apple combina com rotina digital.',
        insertionAngle: 'A marca entra na rotina digital.',
        suggestedDeliverables: ['Reels POV'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 0, evidenceCount: 0 },
      evidencePosts: [],
      reportContent: { executiveSummary: 'Resumo antigo.' },
    });

    expect(deck.activationTimeline.map((step) => step.stepLabel)).toEqual([
      'Contexto',
      'Preparação',
      'Conteúdo principal',
      'Continuidade',
      'Pós-campanha',
    ]);
    expect(deck.activationTimeline[0]).toEqual(
      expect.objectContaining({
        title: 'Apresentar a tensão cotidiana',
        suggestedFormat: 'Stories ou Reels curto',
      })
    );
    expect(deck.activationTimeline[2]).toEqual(
      expect.objectContaining({
        title: 'Reels/POV com conflito e entrada da marca',
        suggestedFormat: 'Reels POV',
      })
    );
    expect(deck.activationTimeline[2]?.brandRole).toContain('pode entrar');
    expect(deck.activationTimeline.map((step) => step.brandRole).join(' ')).not.toContain('campanha aprovada');
    expect(deck.activationTimeline.map((step) => step.brandRole).join(' ')).not.toContain('parceria confirmada');
  });

  it('gera activationTimeline de esporte/corrida com preparação, jornada e fechamento emocional', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Nike', category: ['esporte'] },
      creator: { name: 'O Pai que Corre' },
      pauta: { title: 'Preparação para meia maratona', theme: 'corrida', keywords: ['treino', 'prova'] },
      match: {
        matchedSignals: ['corrida', 'treino', 'meia maratona'],
        rationale: 'Nike combina com corrida.',
        insertionAngle: 'A marca entra na preparação.',
        suggestedDeliverables: ['Reels de jornada'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 0, evidenceCount: 0 },
      evidencePosts: [],
      reportContent: { executiveSummary: 'Resumo antigo.' },
    });

    expect(deck.activationTimeline[0]?.title).toBe('Apresentar desafio, prova ou objetivo');
    expect(deck.activationTimeline[1]?.title).toBe('Treino, kit e bastidores');
    expect(deck.activationTimeline[2]?.suggestedFormat).toBe('Reels de jornada');
    expect(deck.activationTimeline[4]?.title).toBe('Resultado, aprendizado e fechamento emocional');
    expect(deck.activationTimeline[4]?.brandRole).toContain('sem prometer resultado esportivo');
  });

  it('gera activationTimeline de beleza/autocuidado com ritual e continuidade', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Natura', category: ['beleza'] },
      creator: { name: 'Creator Beleza' },
      pauta: { title: 'Autocuidado possível no meio do caos', theme: 'autocuidado', keywords: ['pele', 'rotina real'] },
      match: {
        matchedSignals: ['autocuidado', 'cuidado pessoal', 'rotina real'],
        rationale: 'Natura combina com autocuidado.',
        insertionAngle: 'A marca entra no ritual.',
        suggestedDeliverables: ['Reels de ritual'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 0, evidenceCount: 0 },
      evidencePosts: [],
      reportContent: { executiveSummary: 'Resumo antigo.' },
    });

    expect(deck.activationTimeline[0]?.title).toBe('Apresentar rotina real ou tensão cotidiana');
    expect(deck.activationTimeline[1]?.title).toBe('Bastidor do ritual ou momento de pausa');
    expect(deck.activationTimeline[2]?.suggestedFormat).toBe('Reels de ritual');
    expect(deck.activationTimeline[3]?.title).toBe('Uso e comentários de rotina');
    expect(deck.activationTimeline[2]?.brandRole).toContain('não como anúncio separado');
  });

  it('gera activationTimeline geral mesmo sem suggestedExecution ou activationPlan antigos', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Marca Teste' },
      creator: { name: 'Creator Teste' },
      pauta: { title: 'Uma pauta de rotina' },
      match: {
        rationale: 'Match por comportamento.',
        insertionAngle: 'A marca entra no contexto.',
        suggestedDeliverables: [],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 0, evidenceCount: 0 },
      evidencePosts: [],
      reportContent: { executiveSummary: 'Resumo antigo.' },
    });

    expect(deck.activationTimeline).toHaveLength(5);
    expect(deck.activationTimeline.map((step) => step.stepLabel)).toEqual([
      'Contexto',
      'Preparação',
      'Conteúdo principal',
      'Continuidade',
      'Pós-campanha',
    ]);
    expect(deck.activationTimeline[2]?.suggestedFormat).toBe('Reels principal');
    expect(deck.activationTimeline[2]?.brandRole).toContain('pode entrar');
  });

  it('gera commercialRecap de tecnologia com valor comercial e linguagem segura', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Apple', category: ['tecnologia'] },
      creator: { name: 'Lívia Linhares' },
      pauta: { title: 'Quando você tenta relaxar e o celular toca', keywords: ['celular', 'notificações', 'foco'] },
      match: {
        matchedSignals: ['rotina digital', 'notificações', 'foco'],
        rationale: 'Apple combina com rotina digital.',
        insertionAngle: 'A marca entra na rotina digital.',
        suggestedDeliverables: ['Reels POV'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 20, evidenceCount: 2, totalViews: 11466767, totalInteractions: 1060696 },
      evidencePosts: [
        { id: 'tech-1', title: 'Celular interrompendo a pausa', description: 'notificações e foco', views: 11466767, totalInteractions: 1060696 },
      ],
      reportContent: { executiveSummary: 'Resumo antigo.' },
    });

    const recapText = deck.commercialRecap.bullets.join(' ');
    expect(deck.commercialRecap.title).toBe('Uma oportunidade pronta para conversa');
    expect(recapText).toContain('sinais orgânicos reais');
    expect(recapText).toContain('foco, notificações e equilíbrio digital');
    expect(deck.finalCta.body).toContain('preservar a linguagem natural de Lívia');
    expect(deck.suggestedNextStep).toContain('conversa consultiva');
    expect(recapText).not.toContain('campanha aprovada');
    expect(recapText).not.toContain('marca aceitou');
  });

  it('gera commercialRecap de esporte/corrida como jornada de campanha', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Nike', category: ['esporte'] },
      creator: { name: 'O Pai que Corre' },
      pauta: { title: 'Preparação para meia maratona', theme: 'corrida', keywords: ['treino', 'prova'] },
      match: {
        matchedSignals: ['corrida', 'treino', 'meia maratona'],
        rationale: 'Nike combina com corrida.',
        insertionAngle: 'A marca entra na preparação.',
        suggestedDeliverables: ['Reels de jornada'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 30, evidenceCount: 3, totalViews: 390000, totalInteractions: 42000 },
      evidencePosts: [
        { id: 'run-1', title: 'Treino antes da prova', description: 'Rotina de corrida', views: 250000, totalInteractions: 22000 },
      ],
      reportContent: { executiveSummary: 'Resumo antigo.' },
    });

    const recapText = deck.commercialRecap.bullets.join(' ');
    expect(deck.commercialRecap.title).toBe('Uma jornada pronta para conversa');
    expect(recapText).toContain('preparação, esforço e fechamento emocional');
    expect(recapText).toContain('sem transformar a história em anúncio isolado');
    expect(deck.finalCta.body).toContain('conversa comercial mais objetiva');
  });

  it('gera finalCta e creatorApproachMessage sem promessa comercial indevida', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Apple', category: ['tecnologia'] },
      creator: { name: 'Lívia Linhares' },
      pauta: { title: 'Quando você tenta relaxar e o celular toca', keywords: ['celular', 'notificações'] },
      match: {
        matchedSignals: ['notificações', 'foco'],
        rationale: 'Apple combina com rotina digital.',
        insertionAngle: 'A marca entra na rotina digital.',
        suggestedDeliverables: ['Reels POV'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 10, evidenceCount: 1, totalViews: 100000, totalInteractions: 12000 },
      evidencePosts: [
        { id: 'tech-1', title: 'Celular tocando', description: 'notificações e foco', views: 100000, totalInteractions: 12000 },
      ],
      reportContent: { executiveSummary: 'Resumo antigo.' },
    });

    const unsafeText = [
      deck.finalCta.body,
      deck.finalCta.suggestedMessage,
      deck.approachMessageIntro,
      deck.suggestedNextStep,
    ].join(' ');
    expect(deck.finalCta.suggestedMessage).toContain('Olá, equipe Apple.');
    expect(deck.finalCta.suggestedMessage).toContain('Posso enviar para vocês avaliarem?');
    expect(deck.finalCta.suggestedMessage).toContain('uma sugestão de ativação');
    expect(unsafeText).not.toContain('parceria confirmada');
    expect(unsafeText).not.toContain('campanha aprovada');
    expect(unsafeText).not.toContain('aprovação da marca');
    expect(unsafeText).not.toContain('marca já demonstrou interesse');
  });

  it('mantém compatibilidade do deck com relatórios antigos sem evidências', () => {
    const deck = buildBrandNarrativeDeckPresentation({
      brand: { brandName: 'Nike' },
      creator: { name: 'Creator Teste' },
      pauta: { title: 'Preparação para meia maratona', theme: 'corrida' },
      match: {
        rationale: 'A marca combina com corrida e preparação.',
        insertionAngle: 'A marca pode entrar no kit de treino.',
        suggestedDeliverables: ['1 Reels narrativo'],
        disclaimer: 'Marca sugerida por possível match narrativo.',
      },
      metricsSummary: { postsAnalyzed: 0, evidenceCount: 0 },
      evidencePosts: [],
      reportContent: {
        headline: 'Relatório antigo',
        executiveSummary: 'Resumo antigo.',
        narrativeThesis: 'Tese antiga.',
        brandFit: 'Fit antigo.',
        organicProof: 'Prova antiga.',
        campaignIdea: 'Ideia antiga.',
        suggestedExecution: ['1 Reels narrativo'],
        creatorApproachMessage: 'Mensagem antiga.',
        disclaimer: BRAND_NARRATIVE_REPORT_DISCLAIMER,
      },
    });

    expect(deck.organicSeriesProof.summary).toContain('hipótese estratégica');
    expect(deck.evidenceStoryline).toEqual([]);
    expect(deck.activationTimeline.length).toBeGreaterThan(0);
    expect(deck.heroThesis.disclaimer).toBe(BRAND_NARRATIVE_REPORT_DISCLAIMER);
    expect(deck.commercialRecap.bullets.join(' ')).toContain('hipótese criativa para validação');
    expect(deck.finalCta.body).toContain('hipótese criativa de entrada');
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
