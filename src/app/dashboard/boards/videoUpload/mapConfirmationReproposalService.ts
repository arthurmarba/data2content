import type { CreatorStrategicProfileSynthesis } from './creatorStrategicProfileSynthesis';
import { recordSynthesisMapSuggestions } from '@/app/lib/mapaSeed/synthesisSuggestions';

/** A síntese usa o mesmo mecanismo de propostas do mapa. Uma proposta nunca
 * remove a confirmação atual, inclusive quando o enriquecimento chega depois. */
export async function reproposeConfirmationsIfSynthesisChanged(userId: string, synthesis: CreatorStrategicProfileSynthesis) {
  return recordSynthesisMapSuggestions(userId, synthesis);
}
