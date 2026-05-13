import { 
  PostCreationAdaptiveStudyContext, 
  PostCreationAdaptiveStudySignal 
} from '../postCreationAdaptiveStudyContext';
import { 
  CreatorNarrativeAsset, 
  CreatorNarrativeMap, 
  NarrativeAssetSource, 
  NarrativeAssetType, 
  NarrativeAssetEvidence,
  NarrativeStrategicFunction
} from './postCreationNarrativeAssets';

/**
 * Normalizes a label to be used in ID generation and deduplication.
 */
const normalizeLabel = (label: string): string => {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .trim()
    .replace(/^_+|_+$/g, '');
};

/**
 * Normalizes text for keyword matching (removing accents).
 */
const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Clamps confidence between 0 and 1, with a conservative bias.
 */
const clampConfidence = (score: number, evidenceCount: number): number => {
  const normalizedScore = Math.min(0.7, score / 2000);
  const evidenceBonus = Math.min(0.25, (evidenceCount - 1) * 0.05);
  const base = normalizedScore + evidenceBonus;
  return Math.min(0.95, Math.max(0.2, base));
};

/**
 * Creates an ID for an asset based on its type and label.
 */
const buildAssetId = (type: NarrativeAssetType, label: string): string => {
  return `${type}_${normalizeLabel(label)}`;
};

/**
 * Maps a StudyContext signal to a CreatorNarrativeAsset.
 */
const mapSignalToAsset = (params: {
  signal: PostCreationAdaptiveStudySignal;
  type: NarrativeAssetType;
  source: NarrativeAssetSource;
  timestamp: string;
}): CreatorNarrativeAsset => {
  const { signal, type, source, timestamp } = params;
  const id = buildAssetId(type, signal.label);
  const confidence = clampConfidence(signal.score, signal.evidenceCount);

  const evidence: NarrativeAssetEvidence[] = [
    {
      source,
      label: signal.label,
      reason: signal.reason,
      confidence: confidence,
      metricValue: signal.score,
    }
  ];

  return {
    id,
    type,
    label: signal.label,
    source,
    status: 'suggested',
    confidence,
    evidence,
    strategicFunctions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

/**
 * Deduplicates assets by type and normalized label.
 * When duplicates exist, it merges evidence and takes the highest confidence.
 */
const dedupeAssets = (assets: CreatorNarrativeAsset[]): CreatorNarrativeAsset[] => {
  const map = new Map<string, CreatorNarrativeAsset>();

  for (const asset of assets) {
    const existing = map.get(asset.id);
    if (!existing) {
      map.set(asset.id, asset);
      continue;
    }

    // Merge logic
    existing.confidence = Math.max(existing.confidence, asset.confidence);
    existing.evidence = [...existing.evidence, ...asset.evidence];
    
    // Deterministic timestamp merging
    if (asset.createdAt && existing.createdAt && asset.createdAt < existing.createdAt) {
      existing.createdAt = asset.createdAt;
    }
    if (asset.updatedAt && existing.updatedAt && asset.updatedAt > existing.updatedAt) {
      existing.updatedAt = asset.updatedAt;
    }
  }

  return Array.from(map.values());
};

/**
 * Infers strategic functions from StudyContext engagement drivers.
 */
const inferStrategicFunctions = (studyContext: PostCreationAdaptiveStudyContext): NarrativeStrategicFunction[] => {
  const functions = new Set<NarrativeStrategicFunction>();
  const drivers = studyContext.topEngagementDrivers || [];

  for (const driver of drivers) {
    const label = normalizeText(driver.label);

    // Relationship: comments, interaction, conversation
    if (label.includes('comentario') || label.includes('interacao') || label.includes('conversa')) {
      functions.add('relationship');
    }

    // Authority: saves, tutorials, education, checklist
    if (label.includes('salvamento') || label.includes('tutorial') || label.includes('educa') || label.includes('checklist')) {
      functions.add('authority');
    }

    // Reach: shares, reach, viral
    if (label.includes('compartilha') || label.includes('alcance') || label.includes('viral')) {
      functions.add('reach');
    }

    // Commercial Proof: commercial, brand, product, sale
    if (label.includes('comercial') || label.includes('marca') || label.includes('produto') || label.includes('venda') || label.includes('publi')) {
      functions.add('commercial_proof');
    }

    // Experiment: test, stories, poll, question
    if (label.includes('experimento') || label.includes('teste') || label.includes('stories') || label.includes('enquete') || label.includes('pergunta')) {
      functions.add('experiment');
    }
  }

  return Array.from(functions);
};

/**
 * Builds a CreatorNarrativeMap from a PostCreationAdaptiveStudyContext.
 * This is a deterministic extractor that suggests narrative assets based on study signals.
 */
export function buildCreatorNarrativeMapFromStudyContext(params: {
  creatorId?: string | null;
  studyContext: PostCreationAdaptiveStudyContext | null | undefined;
  generatedAt?: string | null;
}): CreatorNarrativeMap {
  const { creatorId, studyContext, generatedAt } = params;
  const resolvedTimestamp = generatedAt || new Date().toISOString();

  const emptyMap: CreatorNarrativeMap = {
    creatorId: creatorId || null,
    centralNarrative: null,
    assets: [],
    strategicFunctions: [],
    confidence: 0,
    evidence: [],
    generatedAt: resolvedTimestamp,
    updatedAt: resolvedTimestamp,
  };

  if (!studyContext) {
    return emptyMap;
  }

  const rawAssets: CreatorNarrativeAsset[] = [];

  // 1. Themes
  studyContext.topThemes?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'theme', source: 'study_context', timestamp: resolvedTimestamp })));
  studyContext.topThemeKeywords?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'theme', source: 'theme_keyword', timestamp: resolvedTimestamp })));
  studyContext.topCaptionSignals?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'theme', source: 'caption_signal', timestamp: resolvedTimestamp })));

  // 2. Scenarios
  studyContext.topContexts?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'scenario', source: 'study_context', timestamp: resolvedTimestamp })));

  // 3. Languages
  studyContext.topNarratives?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'language', source: 'study_context', timestamp: resolvedTimestamp })));
  studyContext.topNarrativeForms?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'language', source: 'study_context', timestamp: resolvedTimestamp })));
  studyContext.topTones?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'language', source: 'study_context', timestamp: resolvedTimestamp })));

  // 4. Commercial Proof
  studyContext.topProofStyles?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'commercial_proof', source: 'study_context', timestamp: resolvedTimestamp })));
  studyContext.topCommercialModes?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'commercial_proof', source: 'study_context', timestamp: resolvedTimestamp })));
  studyContext.brandSignals?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'commercial_proof', source: 'brand_signal', timestamp: resolvedTimestamp })));

  // 5. Relationships
  studyContext.collabSignals?.forEach(s => rawAssets.push(mapSignalToAsset({ signal: s, type: 'relationship', source: 'collab_signal', timestamp: resolvedTimestamp })));

  // Deduplicate and process
  const assets = dedupeAssets(rawAssets);
  const strategicFunctions = inferStrategicFunctions(studyContext);

  // Overall confidence of the map based on StudyContext confidence and asset richness
  const mapConfidence = Math.min(0.95, (studyContext.confidence?.score || 0) / 100);

  return {
    creatorId: creatorId || null,
    centralNarrative: null,
    assets,
    strategicFunctions,
    confidence: mapConfidence,
    evidence: [
      {
        source: 'study_context',
        label: 'Análise de contexto de estudo',
        reason: studyContext.confidence?.reasons?.join('. ') || 'Baseado em sinais extraídos do material de estudo.',
        confidence: mapConfidence,
      }
    ],
    generatedAt: resolvedTimestamp,
    updatedAt: resolvedTimestamp,
  };
}
