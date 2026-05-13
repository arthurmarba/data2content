import { buildCreatorNarrativeMapFromStudyContext } from './postCreationNarrativeAssetsFromStudyContext';
import { PostCreationAdaptiveStudyContext } from '../postCreationAdaptiveStudyContext';
import { canAutoConfirmAsset } from './postCreationNarrativeAssets';

describe('Narrative Assets Extrator from StudyContext (Coverage Reinforcement)', () => {
  const mockStudyContext: PostCreationAdaptiveStudyContext = {
    source: 'planner_client',
    periodDays: 90,
    confidence: {
      score: 85,
      label: 'high',
      reasons: ['Encontramos recomendacoes suficientes']
    },
    profileSummary: {
      slotsCount: 10,
      recommendationsCount: 5,
      postedSignalsCount: 8,
      evidencePostsCount: 4,
      captionSignalsCount: 20,
      themeSignalsCount: 15,
      qualitativeSignalsCount: 30
    },
    topFormats: [],
    topNarratives: [
      { id: 'nar-1', label: 'Bastidores', score: 500, evidenceCount: 3, reason: 'Test' }
    ],
    topContexts: [
      { id: 'ctx-1', label: 'Escritório', score: 400, evidenceCount: 2, reason: 'Test' }
    ],
    topProposals: [],
    topEngagementDrivers: [
      { id: 'drv-1', label: 'Comentarios', score: 1000, evidenceCount: 5, reason: 'Test' },
      { id: 'drv-2', label: 'Salvamentos', score: 800, evidenceCount: 4, reason: 'Test' }
    ],
    topContentIntents: [],
    topNarrativeForms: [
      { id: 'nf-1', label: 'Humor', score: 300, evidenceCount: 2, reason: 'Test' }
    ],
    topTones: [
      { id: 'tone-1', label: 'Inspiracional', score: 200, evidenceCount: 1, reason: 'Test' }
    ],
    topThemes: [
      { id: 'th-1', label: 'Carreira', score: 1200, evidenceCount: 6, reason: 'Test' }
    ],
    topThemeKeywords: [
      { id: 'tk-1', label: 'Produtividade', score: 600, evidenceCount: 3, reason: 'Test' }
    ],
    topHooks: [],
    topCtas: [],
    topProofStyles: [
      { id: 'ps-1', label: 'Resultados', score: 400, evidenceCount: 2, reason: 'Test' }
    ],
    topStances: [],
    topCommercialModes: [
      { id: 'cm-1', label: 'Venda Direta', score: 300, evidenceCount: 1, reason: 'Test' }
    ],
    topCaptionSignals: [
      { id: 'cs-1', label: 'Rotina', score: 500, evidenceCount: 4, reason: 'Test' }
    ],
    bestPostingWindows: [],
    referencePosts: [],
    brandSignals: [
      { id: 'bs-1', label: 'Parceria Marca X', score: 1000, evidenceCount: 1, reason: 'Test' }
    ],
    collabSignals: [
      { id: 'col-1', label: 'Collab com Creator Y', score: 800, evidenceCount: 1, reason: 'Test' }
    ]
  };

  it('should be deterministic when generatedAt is provided', () => {
    const fixedTimestamp = '2024-05-12T20:00:00.000Z';
    const result = buildCreatorNarrativeMapFromStudyContext({ 
      studyContext: mockStudyContext, 
      generatedAt: fixedTimestamp 
    });

    expect(result.generatedAt).toBe(fixedTimestamp);
    expect(result.updatedAt).toBe(fixedTimestamp);
    expect(result.assets.length).toBeGreaterThan(0);
    expect(result.assets.every(a => a.createdAt === fixedTimestamp)).toBe(true);
    expect(result.assets.every(a => a.updatedAt === fixedTimestamp)).toBe(true);
  });

  it('should generate assets of type "scenario" from topContexts', () => {
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: mockStudyContext });
    const scenario = result.assets.find(a => a.label === 'Escritório');
    
    expect(scenario).toBeDefined();
    expect(scenario?.type).toBe('scenario');
    expect(scenario?.status).toBe('suggested');
    expect(scenario?.source).toBe('study_context');
    expect(scenario?.evidence.length).toBeGreaterThan(0);
  });

  it('should generate assets of type "language" from topNarratives, topNarrativeForms and topTones', () => {
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: mockStudyContext });
    const bastidores = result.assets.find(a => a.label === 'Bastidores');
    const humor = result.assets.find(a => a.label === 'Humor');
    const inspiracional = result.assets.find(a => a.label === 'Inspiracional');
    
    expect(bastidores?.type).toBe('language');
    expect(humor?.type).toBe('language');
    expect(inspiracional?.type).toBe('language');
    
    expect(bastidores?.status).toBe('suggested');
    expect(bastidores?.evidence.length).toBeGreaterThan(0);
  });

  it('should generate assets of type "commercial_proof" from topProofStyles, topCommercialModes and brandSignals', () => {
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: mockStudyContext });
    const resultados = result.assets.find(a => a.label === 'Resultados');
    const vendaDireta = result.assets.find(a => a.label === 'Venda Direta');
    const parceria = result.assets.find(a => a.label === 'Parceria Marca X');
    
    expect(resultados?.type).toBe('commercial_proof');
    expect(vendaDireta?.type).toBe('commercial_proof');
    expect(parceria?.type).toBe('commercial_proof');
    
    expect(resultados?.status).toBe('suggested');
    expect(resultados?.evidence.length).toBeGreaterThan(0);
  });

  it('should generate assets of type "theme" from topThemes, topThemeKeywords and topCaptionSignals', () => {
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: mockStudyContext });
    const carreira = result.assets.find(a => a.label === 'Carreira');
    const produtividade = result.assets.find(a => a.label === 'Produtividade');
    const rotina = result.assets.find(a => a.label === 'Rotina');
    
    expect(carreira?.type).toBe('theme');
    expect(produtividade?.type).toBe('theme');
    expect(rotina?.type).toBe('theme');
    
    expect(carreira?.status).toBe('suggested');
    expect(carreira?.evidence.length).toBeGreaterThan(0);
  });

  it('should infer "reach" from sharing/reach/viral drivers', () => {
    const context: PostCreationAdaptiveStudyContext = {
      ...mockStudyContext,
      topEngagementDrivers: [
        { id: 'd1', label: 'Alcance', score: 100, evidenceCount: 1, reason: 'R1' },
        { id: 'd2', label: 'Viral', score: 100, evidenceCount: 1, reason: 'R2' }
      ]
    };
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: context });
    expect(result.strategicFunctions).toContain('reach');
  });

  it('should infer "commercial_proof" from commercial/brand/product/sale/publi drivers', () => {
    const context: PostCreationAdaptiveStudyContext = {
      ...mockStudyContext,
      topEngagementDrivers: [
        { id: 'd1', label: 'Venda de produtos', score: 100, evidenceCount: 1, reason: 'R1' },
        { id: 'd2', label: 'Marca parceira', score: 100, evidenceCount: 1, reason: 'R2' }
      ]
    };
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: context });
    expect(result.strategicFunctions).toContain('commercial_proof');
  });

  it('should infer "experiment" from test/stories/poll/question drivers', () => {
    const context: PostCreationAdaptiveStudyContext = {
      ...mockStudyContext,
      topEngagementDrivers: [
        { id: 'd1', label: 'Enquete nos stories', score: 100, evidenceCount: 1, reason: 'R1' },
        { id: 'd2', label: 'Teste de formato', score: 100, evidenceCount: 1, reason: 'R2' }
      ]
    };
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: context });
    expect(result.strategicFunctions).toContain('experiment');
  });

  it('should infer "relationship" from accented drivers like "Comentários" and "Interações"', () => {
    const context: PostCreationAdaptiveStudyContext = {
      ...mockStudyContext,
      topEngagementDrivers: [
        { id: 'drv-1', label: 'Comentários', score: 100, evidenceCount: 1, reason: 'Test' },
        { id: 'drv-2', label: 'Interações', score: 100, evidenceCount: 1, reason: 'Test' }
      ]
    };

    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: context });
    expect(result.strategicFunctions).toContain('relationship');
  });

  it('should maintain all assets as "suggested"', () => {
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: mockStudyContext });
    expect(result.assets.length).toBeGreaterThan(0);
    expect(result.assets.every(a => a.status === 'suggested')).toBe(true);
  });

  it('should ensure every asset has a stable ID based on type + normalized label', () => {
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: mockStudyContext });
    
    const carreira = result.assets.find(a => a.label === 'Carreira');
    expect(carreira?.id).toBe('theme_carreira');
    
    const escritorio = result.assets.find(a => a.label === 'Escritório');
    expect(escritorio?.id).toBe('scenario_escritorio');
    
    const vendaDireta = result.assets.find(a => a.label === 'Venda Direta');
    expect(vendaDireta?.id).toBe('commercial_proof_venda_direta');
  });

  it('should ensure centralNarrative remains null in this phase', () => {
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: mockStudyContext });
    expect(result.centralNarrative).toBeNull();
  });

  it('should deduplicate assets and keep accumulating evidence', () => {
    const studyContextWithDupes: PostCreationAdaptiveStudyContext = {
      ...mockStudyContext,
      topThemes: [
        { id: 'th-1', label: 'Carreira', score: 1200, evidenceCount: 6, reason: 'First' },
      ],
      topThemeKeywords: [
        { id: 'tk-1', label: 'carreira', score: 600, evidenceCount: 3, reason: 'Second' }
      ]
    };

    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: studyContextWithDupes });
    const carreraAssets = result.assets.filter(a => a.type === 'theme' && a.label.toLowerCase() === 'carreira');
    
    expect(carreraAssets.length).toBe(1);
    expect(carreraAssets[0].evidence.length).toBe(2);
    expect(carreraAssets[0].evidence.some(e => e.reason === 'First')).toBe(true);
    expect(carreraAssets[0].evidence.some(e => e.reason === 'Second')).toBe(true);
  });

  it('should NOT allow auto-confirmation for relationship assets', () => {
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: mockStudyContext });
    const collabAsset = result.assets.find(a => a.type === 'relationship');
    
    expect(collabAsset).toBeDefined();
    expect(canAutoConfirmAsset(collabAsset!)).toBe(false);
  });

  it('should return empty map when studyContext is null', () => {
    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: null });
    expect(result.assets).toEqual([]);
    expect(result.strategicFunctions).toEqual([]);
  });
});
