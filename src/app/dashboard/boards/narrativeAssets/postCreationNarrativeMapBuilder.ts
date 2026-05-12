import type { PostCreationAdaptiveStudyContext } from '../postCreationAdaptiveStudyContext';
import type { CreatorNarrativeMap } from './postCreationNarrativeAssets';
import { buildCreatorNarrativeMapFromStudyContext } from './postCreationNarrativeAssetsFromStudyContext';
import { buildCreatorCentralNarrativeFromMap } from './postCreationCentralNarrative';

/**
 * Orquestrates the full creation of a Narrative Map from a Study Context.
 * 
 * 1. Extracts narrative assets and strategic functions from StudyContext.
 * 2. Synthesizes a central narrative hypothesis if there is sufficient evidence.
 * 
 * This is a pure composition of the extraction and synthesis modules.
 */
export function buildCreatorNarrativeMap(params: {
  creatorId?: string | null;
  studyContext: PostCreationAdaptiveStudyContext | null | undefined;
  generatedAt?: string | null;
}): CreatorNarrativeMap {
  // 1. Extract assets and strategic functions
  const map = buildCreatorNarrativeMapFromStudyContext(params);

  // 2. Try to synthesize a central narrative hypothesis
  const centralNarrative = buildCreatorCentralNarrativeFromMap(map);

  // 3. Return the composed map
  return {
    ...map,
    centralNarrative
  };
}
