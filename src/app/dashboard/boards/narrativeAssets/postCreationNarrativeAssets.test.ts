import { 
  CreatorNarrativeAsset, 
  CreatorNarrativeMap, 
  CreatorCentralNarrative,
  NarrativeAssetType,
  NarrativeStrategicFunction,
  isSensitiveAssetType,
  canAutoConfirmAsset
} from './postCreationNarrativeAssets';

describe('Narrative DNA Contracts', () => {
  it('should be possible to create a CreatorNarrativeAsset for each type', () => {
    const types: NarrativeAssetType[] = [
      'personal',
      'scenario',
      'relationship',
      'tension',
      'theme',
      'language',
      'commercial_proof',
      'narrative_limit'
    ];

    types.forEach(type => {
      const asset: CreatorNarrativeAsset = {
        id: `asset-${type}`,
        type,
        label: `Test ${type}`,
        source: 'study_context',
        status: 'suggested',
        confidence: 0.9,
        evidence: [
          {
            source: 'study_context',
            label: 'Found in study',
            reason: 'Explicit mention'
          }
        ]
      };
      expect(asset.type).toBe(type);
    });
  });

  it('should be possible to create a CreatorNarrativeMap with various asset statuses', () => {
    const map: CreatorNarrativeMap = {
      assets: [
        {
          id: '1',
          type: 'theme',
          label: 'Suggested Theme',
          source: 'caption_signal',
          status: 'suggested',
          confidence: 0.7,
          evidence: []
        },
        {
          id: '2',
          type: 'scenario',
          label: 'Confirmed Scenario',
          source: 'declared_by_creator',
          status: 'confirmed',
          confidence: 1.0,
          evidence: []
        },
        {
          id: '3',
          type: 'tension',
          label: 'Rejected Tension',
          source: 'manual_user_rejection',
          status: 'rejected',
          confidence: 1.0,
          evidence: []
        },
        {
          id: '4',
          type: 'language',
          label: 'Hidden Language',
          source: 'system_rule',
          status: 'hidden',
          confidence: 1.0,
          evidence: []
        }
      ],
      strategicFunctions: ['reach'],
      confidence: 0.8,
      evidence: []
    };

    expect(map.assets.length).toBe(4);
    expect(map.assets.find(a => a.status === 'suggested')).toBeDefined();
    expect(map.assets.find(a => a.status === 'confirmed')).toBeDefined();
    expect(map.assets.find(a => a.status === 'rejected')).toBeDefined();
    expect(map.assets.find(a => a.status === 'hidden')).toBeDefined();
  });

  it('should support commercial_proof as both asset type and strategic function', () => {
    const asset: CreatorNarrativeAsset = {
      id: 'cp-1',
      type: 'commercial_proof',
      label: 'Sold 100 units',
      source: 'user_checkin',
      status: 'confirmed',
      confidence: 1.0,
      evidence: [],
      strategicFunctions: ['commercial_proof']
    };

    const strategicFunctions: NarrativeStrategicFunction[] = ['commercial_proof', 'authority'];

    expect(asset.type).toBe('commercial_proof');
    expect(asset.strategicFunctions).toContain('commercial_proof');
    expect(strategicFunctions).toContain('commercial_proof');
  });

  it('should be possible to represent narrative_limit', () => {
    const asset: CreatorNarrativeAsset = {
      id: 'limit-1',
      type: 'narrative_limit',
      label: 'No political talk',
      source: 'declared_by_creator',
      status: 'confirmed',
      confidence: 1.0,
      evidence: [
        {
          source: 'declared_by_creator',
          label: 'User setting',
          reason: 'User explicitly said no politics'
        }
      ]
    };

    expect(asset.type).toBe('narrative_limit');
  });

  it('should be possible to create a CreatorCentralNarrative suggested with evidence', () => {
    const centralNarrative: CreatorCentralNarrative = {
      statement: 'Authentic living for busy parents',
      status: 'suggested',
      confidence: 0.85,
      evidence: [
        {
          source: 'study_context',
          label: 'Parenting and Efficiency themes',
          reason: 'Recurring themes in last 10 posts'
        }
      ],
      supportingAssetIds: ['asset-1', 'asset-2']
    };

    expect(centralNarrative.status).toBe('suggested');
    expect(centralNarrative.evidence.length).toBeGreaterThan(0);
    expect(centralNarrative.supportingAssetIds?.length).toBe(2);
  });

  it('should represent personal and relationship assets as suggested and identify them correctly', () => {
    const personalAsset: CreatorNarrativeAsset = {
      id: 'p-1',
      type: 'personal',
      label: 'Has young children',
      source: 'caption_signal',
      status: 'suggested',
      confidence: 0.8,
      evidence: []
    };

    const relationshipAsset: CreatorNarrativeAsset = {
      id: 'r-1',
      type: 'relationship',
      label: 'Married to a doctor',
      source: 'caption_signal',
      status: 'suggested',
      confidence: 0.8,
      evidence: []
    };

    expect(isSensitiveAssetType(personalAsset.type)).toBe(true);
    expect(isSensitiveAssetType(relationshipAsset.type)).toBe(true);
    expect(canAutoConfirmAsset(personalAsset)).toBe(false);
    expect(canAutoConfirmAsset(relationshipAsset)).toBe(false);
  });

  it('should distinguish between sensitive and non-sensitive for auto-confirmation', () => {
    const personalAsset: Partial<CreatorNarrativeAsset> = { type: 'personal' };
    const relationshipAsset: Partial<CreatorNarrativeAsset> = { type: 'relationship' };
    const themeAsset: Partial<CreatorNarrativeAsset> = { type: 'theme' };
    const scenarioAssetWithSensitiveFlag: Partial<CreatorNarrativeAsset> = { type: 'scenario', isSensitive: true };
    const assetWithoutType: Partial<CreatorNarrativeAsset> = { label: 'Unknown' };

    expect(canAutoConfirmAsset(personalAsset)).toBe(false);
    expect(canAutoConfirmAsset(relationshipAsset)).toBe(false);
    expect(canAutoConfirmAsset(themeAsset)).toBe(true);
    expect(canAutoConfirmAsset(scenarioAssetWithSensitiveFlag)).toBe(false);
    expect(canAutoConfirmAsset(assetWithoutType)).toBe(false);
  });
});
