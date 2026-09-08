import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import MapaSeed from '@/app/models/MapaSeed';
import Confirmations from '@/app/models/CreatorMapConfirmations';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import type { CreatorStrategicProfileSynthesis } from '@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis';
import { reconcileMapSuggestions } from './mapSuggestions';

export async function recordSynthesisMapSuggestions(userId: string, synthesis: CreatorStrategicProfileSynthesis) {
  const summary = { narrativeRepoposed: false, toneReproposed: false, territoriesReproposed: false };
  if (!Types.ObjectId.isValid(userId)) return summary;
  try {
    await connectToDatabase();
    const [doc, confirmations] = await Promise.all([MapaSeed.findOne({ userId }), Confirmations.findOne({ userId }).lean()]);
    if (!doc) return summary;
    const proposed = { narrativa_central: synthesis.mainNarrative?.label ?? doc.mapa.narrativa_central,
      tom: synthesis.dominantTone ?? doc.mapa.tom, territorios: synthesis.narrativeTerritories.map(item => item.label) };
    const ids = [...new Set([...(synthesis.mainNarrative?.diagnosisIds ?? []), ...synthesis.toneSignals.flatMap(item => item.diagnosisIds), ...synthesis.narrativeTerritories.flatMap(item => item.diagnosisIds)])].sort();
    if (ids.length === 0) return summary;
    const revision = createHash('sha256').update(JSON.stringify({ ids, proposed })).digest('hex');
    const next = reconcileMapSuggestions(doc.mapa, doc.mapa, proposed, { narrativeLocked: true, toneLocked: true }, { source: 'video', revision, evidence: ids.map(id => ({ id })) });
    doc.mapa.suggestions = next.suggestions;
    doc.markModified('mapa.suggestions');
    await doc.save();
    for (const [dimension, value] of [['narrative', doc.mapa.narrativa_central], ['tone', doc.mapa.tom], ['territories', doc.mapa.territorios.join(' | ')]] as const) {
      if (confirmations?.[dimension]?.state === 'confirmed' && !confirmations[dimension].confirmedValue) {
        await Confirmations.updateOne({ userId, [`${dimension}.confirmedValue`]: null }, { $set: {
          [`${dimension}.confirmedValue`]: value, [`${dimension}.confirmedRevision`]: revision, [`${dimension}.valueOrigin`]: 'migration',
        } });
      }
    }
    summary.narrativeRepoposed = next.suggestions?.some(item => item.section === 'narrativa_central' && item.state === 'pending') ?? false;
    summary.toneReproposed = next.suggestions?.some(item => item.section === 'tom' && item.state === 'pending') ?? false;
    summary.territoriesReproposed = next.suggestions?.some(item => item.section === 'territorios' && item.state === 'pending') ?? false;
  } catch (error) { logger.warn('[mapa][proposta_sintese_falhou]', { userId, error: String(error) }); }
  return summary;
}
