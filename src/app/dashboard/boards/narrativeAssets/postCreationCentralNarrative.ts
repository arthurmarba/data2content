import type { 
  CreatorNarrativeAsset, 
  CreatorNarrativeMap, 
  CreatorCentralNarrative,
  NarrativeAssetEvidence
} from './postCreationNarrativeAssets';

/**
 * Normalizes text for use in statements.
 */
const normalizeText = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Normalizes text for safety checks (removes accents and lowercases).
 */
const normalizeForSafetyCheck = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Checks if an asset is usable for synthesizing the central narrative.
 */
const isUsableAsset = (asset: CreatorNarrativeAsset): boolean => {
  if (asset.status === 'rejected' || asset.status === 'hidden') return false;
  
  // Sensitive assets are ignored in the statement synthesis in this phase
  if (asset.type === 'personal' || asset.type === 'relationship' || asset.isSensitive) return false;
  
  return true;
};

/**
 * Builds the narrative statement based on primary assets.
 */
const buildStatement = (params: {
  theme?: CreatorNarrativeAsset;
  language?: CreatorNarrativeAsset;
  scenario?: CreatorNarrativeAsset;
}): string | null => {
  const { theme, language, scenario } = params;

  if (!theme) return null;

  const themeLabel = theme.label;
  const languageLabel = language ? normalizeText(language.label) : null;
  const scenarioLabel = scenario ? scenario.label.toLowerCase() : null;

  // Pattern: "Language de theme em contexto de scenario"
  if (languageLabel && scenarioLabel) {
    return `${languageLabel} de ${themeLabel.toLowerCase()} em contexto de ${scenarioLabel}`;
  }

  // Pattern: "Language de theme"
  if (languageLabel) {
    return `${languageLabel} de ${themeLabel.toLowerCase()}`;
  }

  // Pattern: "Theme em contexto de scenario"
  if (scenarioLabel) {
    return `${normalizeText(themeLabel)} em contexto de ${scenarioLabel}`;
  }

  // Pattern: Fallback for theme only (though criteria requires at least one more)
  return normalizeText(themeLabel);
};

/**
 * Calculates the confidence for the central narrative.
 */
const calculateConfidence = (params: {
  mapConfidence: number;
  assets: CreatorNarrativeAsset[];
  totalEvidenceCount: number;
}): number => {
  const { mapConfidence, assets, totalEvidenceCount } = params;
  
  if (assets.length === 0) return 0;
  
  const assetsAverageConfidence = assets.reduce((sum, a) => sum + a.confidence, 0) / assets.length;
  const baseConfidence = (mapConfidence + assetsAverageConfidence) / 2;
  
  // Apply caps
  let cap = 0.85;
  if (assets.length < 3 || totalEvidenceCount < 3) {
    cap = 0.65;
  }
  
  return Math.min(cap, baseConfidence);
};

/**
 * Collects and deduplicates evidence from assets.
 */
const collectEvidence = (assets: CreatorNarrativeAsset[]): NarrativeAssetEvidence[] => {
  const evidenceMap = new Map<string, NarrativeAssetEvidence>();
  
  for (const asset of assets) {
    for (const e of asset.evidence) {
      const key = `${e.source}_${e.label}`;
      if (!evidenceMap.has(key)) {
        evidenceMap.set(key, e);
      }
    }
  }
  
  return Array.from(evidenceMap.values()).slice(0, 5); // Limit to 5 for the synthesis
};

/**
 * Synthesizes a central narrative hypothesis from a CreatorNarrativeMap.
 */
export function buildCreatorCentralNarrativeFromMap(map: CreatorNarrativeMap): CreatorCentralNarrative | null {
  // 1. Validation criteria
  if (!map || !map.assets || map.confidence < 0.45) return null;

  const usableAssets = map.assets.filter(isUsableAsset);
  if (usableAssets.length < 2) return null;

  const themes = usableAssets.filter(a => a.type === 'theme');
  const languages = usableAssets.filter(a => a.type === 'language');
  const scenarios = usableAssets.filter(a => a.type === 'scenario');

  if (themes.length === 0) return null;
  if (languages.length === 0 && scenarios.length === 0) return null;

  // 2. Select primary assets (highest confidence)
  const primaryTheme = [...themes].sort((a, b) => b.confidence - a.confidence)[0];
  const primaryLanguage = [...languages].sort((a, b) => b.confidence - a.confidence)[0];
  const primaryScenario = [...scenarios].sort((a, b) => b.confidence - a.confidence)[0];

  // 3. Build Statement
  const statement = buildStatement({
    theme: primaryTheme,
    language: primaryLanguage,
    scenario: primaryScenario
  });

  if (!statement) return null;

  // Final check for prohibited terms with normalization
  const normalizedStatement = normalizeForSafetyCheck(statement);
  const prohibitedKeywords = [
    'comprovado',
    'garantido',
    'certeza',
    'sua narrativa e',
    'sua identidade e'
  ];

  if (prohibitedKeywords.some(keyword => normalizedStatement.includes(keyword))) {
    return null;
  }

  // 4. Supporting Assets and Evidence
  const selectedAssets = [primaryTheme, primaryLanguage, primaryScenario].filter((a): a is CreatorNarrativeAsset => Boolean(a));
  const supportingAssetIds = selectedAssets.map(a => a.id);
  const evidence = collectEvidence(selectedAssets);

  if (evidence.length < 2) return null;

  // 5. Confidence
  const confidence = calculateConfidence({
    mapConfidence: map.confidence,
    assets: selectedAssets,
    totalEvidenceCount: evidence.length
  });

  return {
    statement,
    status: 'suggested',
    confidence,
    evidence,
    supportingAssetIds
  };
}
