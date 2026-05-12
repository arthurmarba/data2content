import { buildCreatorCentralNarrativeFromMap } from './postCreationCentralNarrative';
import type { CreatorNarrativeMap, CreatorNarrativeAsset } from './postCreationNarrativeAssets';

describe('Central Narrative Synthesis (Hardening)', () => {
  const createMockAsset = (overrides: Partial<CreatorNarrativeAsset>): CreatorNarrativeAsset => ({
    id: 'asset-id',
    type: 'theme',
    label: 'Test',
    source: 'study_context',
    status: 'suggested',
    confidence: 0.8,
    evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }],
    ...overrides
  });

  const createMockMap = (overrides: Partial<CreatorNarrativeMap>): CreatorNarrativeMap => ({
    assets: [],
    strategicFunctions: [],
    confidence: 0.8,
    evidence: [],
    ...overrides
  });

  it('should return null when map.assets is empty', () => {
    const map = createMockMap({ assets: [] });
    expect(buildCreatorCentralNarrativeFromMap(map)).toBeNull();
  });

  it('should return null when map.confidence is too low', () => {
    const map = createMockMap({
      confidence: 0.3,
      assets: [
        createMockAsset({ type: 'theme', label: 'Carreira', evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }] }),
        createMockAsset({ type: 'language', label: 'Bastidores', evidence: [{ source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });
    expect(buildCreatorCentralNarrativeFromMap(map)).toBeNull();
  });

  it('should return null when there is only theme without language or scenario', () => {
    const map = createMockMap({
      assets: [
        createMockAsset({ id: '1', type: 'theme', label: 'Carreira', evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }] }),
        createMockAsset({ id: '2', type: 'theme', label: 'Finanças', evidence: [{ source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });
    expect(buildCreatorCentralNarrativeFromMap(map)).toBeNull();
  });

  it('should generate suggested narrative when there is theme + language', () => {
    const map = createMockMap({
      assets: [
        createMockAsset({ id: '1', type: 'theme', label: 'Carreira', confidence: 0.8, evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }] }),
        createMockAsset({ id: '2', type: 'language', label: 'Bastidores', confidence: 0.7, evidence: [{ source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });
    const result = buildCreatorCentralNarrativeFromMap(map);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('suggested');
    expect(result?.statement).toBe('Bastidores de carreira');
  });

  it('should generate suggested narrative when there is theme + scenario', () => {
    const map = createMockMap({
      assets: [
        createMockAsset({ id: '1', type: 'theme', label: 'Produtividade', confidence: 0.8, evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }] }),
        createMockAsset({ id: '2', type: 'scenario', label: 'Escritório', confidence: 0.7, evidence: [{ source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });
    const result = buildCreatorCentralNarrativeFromMap(map);
    expect(result?.statement).toBe('Produtividade em contexto de escritório');
  });

  it('should NOT use personal or relationship sensitive assets in the statement', () => {
    const map = createMockMap({
      assets: [
        createMockAsset({ id: '1', type: 'theme', label: 'Rotina', evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }] }),
        createMockAsset({ id: '2', type: 'personal', label: 'Filhos' }),
        createMockAsset({ id: '3', type: 'relationship', label: 'Casamento' }),
        createMockAsset({ id: '4', type: 'language', label: 'Humor', evidence: [{ source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });
    const result = buildCreatorCentralNarrativeFromMap(map);
    expect(result?.statement).toBe('Humor de rotina');
    expect(result?.statement).not.toContain('Filhos');
    expect(result?.statement).not.toContain('Casamento');
  });

  it('should include and deduplicate evidence from the assets used without as any', () => {
    const evidence1 = { source: 'study_context' as const, label: 'E1', reason: 'R1' };
    const map = createMockMap({
      assets: [
        createMockAsset({ id: '1', type: 'theme', label: 'Carreira', evidence: [evidence1] }),
        createMockAsset({ id: '2', type: 'language', label: 'Bastidores', evidence: [evidence1, { source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });
    const result = buildCreatorCentralNarrativeFromMap(map);
    expect(result?.evidence.length).toBe(2);
    expect(result?.evidence[0].source).toBe('study_context');
  });

  it('should limit confidence to 0.65 when there are few assets/evidence', () => {
    const map = createMockMap({
      confidence: 0.9,
      assets: [
        createMockAsset({ id: '1', type: 'theme', label: 'Carreira', confidence: 0.9, evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }] }),
        createMockAsset({ id: '2', type: 'language', label: 'Bastidores', confidence: 0.9, evidence: [{ source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });
    const result = buildCreatorCentralNarrativeFromMap(map);
    expect(result?.confidence).toBeLessThanOrEqual(0.65);
  });

  it('should return null if prohibited terms are detected (even with accents)', () => {
    const mapWithAccent = createMockMap({
      assets: [
        createMockAsset({ id: '1', type: 'theme', label: 'Sua narrativa é carreira', evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }] }),
        createMockAsset({ id: '2', type: 'language', label: 'Bastidores', evidence: [{ source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });
    
    const mapWithIdentity = createMockMap({
      assets: [
        createMockAsset({ id: '1', type: 'theme', label: 'Sua identidade é marketing', evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }] }),
        createMockAsset({ id: '2', type: 'language', label: 'Bastidores', evidence: [{ source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });

    const mapWithCertainty = createMockMap({
      assets: [
        createMockAsset({ id: '1', type: 'theme', label: 'Carreira com certeza', evidence: [{ source: 'study_context', label: 'E1', reason: 'R1' }] }),
        createMockAsset({ id: '2', type: 'language', label: 'Bastidores', evidence: [{ source: 'study_context', label: 'E2', reason: 'R2' }] })
      ]
    });

    expect(buildCreatorCentralNarrativeFromMap(mapWithAccent)).toBeNull();
    expect(buildCreatorCentralNarrativeFromMap(mapWithIdentity)).toBeNull();
    expect(buildCreatorCentralNarrativeFromMap(mapWithCertainty)).toBeNull();
  });
});
