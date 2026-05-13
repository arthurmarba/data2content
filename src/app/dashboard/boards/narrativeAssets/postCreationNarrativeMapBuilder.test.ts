import { buildCreatorNarrativeMap } from './postCreationNarrativeMapBuilder';
import { PostCreationAdaptiveStudyContext } from '../postCreationAdaptiveStudyContext';

describe('Narrative Map Builder Composition', () => {
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
      { id: 'nar-1', label: 'Bastidores', score: 500, evidenceCount: 3, reason: 'R1' }
    ],
    topContexts: [
      { id: 'ctx-1', label: 'Escritório', score: 400, evidenceCount: 2, reason: 'R2' }
    ],
    topProposals: [],
    topEngagementDrivers: [
      { id: 'drv-1', label: 'Comentarios', score: 1000, evidenceCount: 5, reason: 'R3' }
    ],
    topContentIntents: [],
    topNarrativeForms: [],
    topTones: [],
    topThemes: [
      { id: 'th-1', label: 'Carreira', score: 1200, evidenceCount: 6, reason: 'R4' }
    ],
    topThemeKeywords: [],
    topHooks: [],
    topCtas: [],
    topProofStyles: [],
    topStances: [],
    topCommercialModes: [],
    topCaptionSignals: [],
    bestPostingWindows: [],
    referencePosts: [],
    brandSignals: [],
    collabSignals: []
  };

  it('should return an empty map with null centralNarrative when studyContext is null', () => {
    const result = buildCreatorNarrativeMap({ studyContext: null });
    expect(result.assets).toEqual([]);
    expect(result.centralNarrative).toBeNull();
  });

  it('should return a map with assets when studyContext has signals', () => {
    const result = buildCreatorNarrativeMap({ studyContext: mockStudyContext });
    expect(result.assets.length).toBeGreaterThan(0);
    expect(result.assets.some(a => a.label === 'Carreira')).toBe(true);
  });

  it('should fill centralNarrative when there is sufficient evidence', () => {
    const result = buildCreatorNarrativeMap({ studyContext: mockStudyContext });
    
    // In mockStudyContext:
    // Carreira (theme)
    // Bastidores (language)
    // Escritório (scenario)
    // Confidence is 85/100 = 0.85 (>= 0.45)
    // Multiple evidences R1, R2, R4
    
    expect(result.centralNarrative).not.toBeNull();
    expect(result.centralNarrative?.status).toBe('suggested');
    expect(result.centralNarrative?.statement).toContain('Bastidores');
    expect(result.centralNarrative?.statement).toContain('carreira');
  });

  it('should keep centralNarrative null when signals are insufficient', () => {
    const poorContext: PostCreationAdaptiveStudyContext = {
      ...mockStudyContext,
      confidence: { score: 20, label: 'low', reasons: [] }, // confidence < 0.45
      topThemes: [],
      topNarratives: []
    };
    
    const result = buildCreatorNarrativeMap({ studyContext: poorContext });
    expect(result.centralNarrative).toBeNull();
  });

  it('should preserve creatorId', () => {
    const creatorId = 'user-123';
    const result = buildCreatorNarrativeMap({ studyContext: mockStudyContext, creatorId });
    expect(result.creatorId).toBe(creatorId);
  });

  it('should preserve generatedAt and updatedAt when provided', () => {
    const generatedAt = '2024-05-12T20:00:00.000Z';
    const result = buildCreatorNarrativeMap({ studyContext: mockStudyContext, generatedAt });
    
    expect(result.generatedAt).toBe(generatedAt);
    expect(result.updatedAt).toBe(generatedAt);
    expect(result.assets[0].createdAt).toBe(generatedAt);
  });

  it('should maintain all assets as suggested', () => {
    const result = buildCreatorNarrativeMap({ studyContext: mockStudyContext });
    expect(result.assets.every(a => a.status === 'suggested')).toBe(true);
  });

  it('should maintain strategicFunctions from the extractor', () => {
    const result = buildCreatorNarrativeMap({ studyContext: mockStudyContext });
    // Comentarios -> relationship
    expect(result.strategicFunctions).toContain('relationship');
  });
});
