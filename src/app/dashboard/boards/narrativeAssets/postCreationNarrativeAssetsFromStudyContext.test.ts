import { buildCreatorNarrativeMapFromStudyContext } from './postCreationNarrativeAssetsFromStudyContext';
import { PostCreationAdaptiveStudyContext } from '../postCreationAdaptiveStudyContext';
import { canAutoConfirmAsset } from './postCreationNarrativeAssets';

describe('Narrative Assets Extrator from StudyContext (Hardening)', () => {
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
    expect(result.assets[0].createdAt).toBe(fixedTimestamp);
    expect(result.assets[0].updatedAt).toBe(fixedTimestamp);
  });

  it('should infer relationship function from accented drivers like "Comentários" and "Interações"', () => {
    const contextWithAccents: PostCreationAdaptiveStudyContext = {
      ...mockStudyContext,
      topEngagementDrivers: [
        { id: 'drv-1', label: 'Comentários', score: 100, evidenceCount: 1, reason: 'Test' },
        { id: 'drv-2', label: 'Interações', score: 100, evidenceCount: 1, reason: 'Test' }
      ]
    };

    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: contextWithAccents });
    expect(result.strategicFunctions).toContain('relationship');
  });

  it('should NOT infer "positioning" for unknown engagement drivers', () => {
    const contextWithUnknown: PostCreationAdaptiveStudyContext = {
      ...mockStudyContext,
      topEngagementDrivers: [
        { id: 'drv-unk', label: 'Algum driver aleatorio', score: 100, evidenceCount: 1, reason: 'Test' }
      ]
    };

    const result = buildCreatorNarrativeMapFromStudyContext({ studyContext: contextWithUnknown });
    expect(result.strategicFunctions).not.toContain('positioning');
    expect(result.strategicFunctions.length).toBe(0);
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

  it('should allow relationship suggested from collabSignals and respect sensitive rules', () => {
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
