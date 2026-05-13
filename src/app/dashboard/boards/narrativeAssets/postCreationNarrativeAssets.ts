/**
 * Narrative DNA Contracts
 * 
 * This module defines the core types for the Narrative DNA of a creator.
 * It is a pure TypeScript module, with no dependencies on React, DB, or external services.
 */

/**
 * The type of a narrative asset.
 */
export type NarrativeAssetType =
  | 'personal'
  | 'scenario'
  | 'relationship'
  | 'tension'
  | 'theme'
  | 'language'
  | 'commercial_proof'
  | 'narrative_limit';

/**
 * The source from which a narrative asset was derived.
 */
export type NarrativeAssetSource =
  | 'study_context'
  | 'caption_signal'
  | 'theme_keyword'
  | 'reference_post'
  | 'user_checkin'
  | 'declared_by_creator'
  | 'manual_user_confirmation'
  | 'manual_user_rejection'
  | 'brand_signal'
  | 'collab_signal'
  | 'system_rule';

/**
 * The current status of a narrative asset.
 */
export type NarrativeAssetStatus =
  | 'suggested'
  | 'confirmed'
  | 'rejected'
  | 'hidden';

/**
 * The strategic function that content serves within the narrative.
 */
export type NarrativeStrategicFunction =
  | 'reach'
  | 'relationship'
  | 'authority'
  | 'positioning'
  | 'commercial_proof'
  | 'experiment';

/**
 * Evidence supporting why a narrative asset was suggested or confirmed.
 */
export type NarrativeAssetEvidence = {
  source: NarrativeAssetSource;
  label: string;
  reason?: string | null;
  postId?: string | null;
  postUrl?: string | null;
  metricName?: string | null;
  metricValue?: number | null;
  confidence?: number | null;
};

/**
 * A specific building block of a creator's narrative.
 */
export type CreatorNarrativeAsset = {
  id: string;
  type: NarrativeAssetType;
  label: string;
  description?: string | null;
  source: NarrativeAssetSource;
  status: NarrativeAssetStatus;
  confidence: number;
  evidence: NarrativeAssetEvidence[];
  strategicFunctions?: NarrativeStrategicFunction[];
  isSensitive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastSeenAt?: string | null;
};

/**
 * The core hypothesis of the creator's central narrative.
 */
export type CreatorCentralNarrative = {
  statement: string;
  status: NarrativeAssetStatus;
  confidence: number;
  evidence: NarrativeAssetEvidence[];
  supportingAssetIds?: string[];
};

/**
 * The complete map of a creator's narrative DNA.
 */
export type CreatorNarrativeMap = {
  creatorId?: string | null;
  centralNarrative?: CreatorCentralNarrative | null;
  assets: CreatorNarrativeAsset[];
  strategicFunctions: NarrativeStrategicFunction[];
  confidence: number;
  evidence: NarrativeAssetEvidence[];
  generatedAt?: string | null;
  updatedAt?: string | null;
};

/**
 * A strategic diagnosis of the creator's narrative state.
 */
export type CreatorNarrativeDiagnosis = {
  summary: string;
  emotionalReading?: string | null;
  strategicReading?: string | null;
  reinforcedAssetIds?: string[];
  weakenedAssetIds?: string[];
  suggestedStrategicFunctions?: NarrativeStrategicFunction[];
  warnings?: string[];
  recommendations?: string[];
  confidence: number;
  evidence: NarrativeAssetEvidence[];
};

/**
 * Default set of asset types considered sensitive.
 * These types often involve personal or private information.
 */
const DEFAULT_SENSITIVE_ASSET_TYPES = new Set<NarrativeAssetType>([
  'personal',
  'relationship',
]);

/**
 * Helper to check if an asset type is considered sensitive.
 * Sensitive assets should be suggested but never auto-confirmed by heuristics.
 */
export const isSensitiveAssetType = (type: NarrativeAssetType): boolean => {
  return DEFAULT_SENSITIVE_ASSET_TYPES.has(type);
};

/**
 * Evaluates if the system can automatically confirm a narrative asset without explicit user review.
 * 
 * Assets that are sensitive (by type or explicit flag) should never be auto-confirmed 
 * to ensure creator privacy and narrative accuracy. 
 * If the type is missing, it's considered unsafe to auto-confirm.
 */
export const canAutoConfirmAsset = (asset: Partial<CreatorNarrativeAsset>): boolean => {
  if (!asset.type) return false;
  return !isSensitiveAssetType(asset.type) && asset.isSensitive !== true;
};
