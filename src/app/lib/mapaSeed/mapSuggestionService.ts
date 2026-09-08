import mongoose from 'mongoose';
import MapaSeed from '@/app/models/MapaSeed';
import Confirmations from '@/app/models/CreatorMapConfirmations';
import { connectToDatabase } from '@/app/lib/mongoose';
import type { IMapaData } from '@/app/models/MapaSeed';

export class MapSuggestionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function readMapSuggestions(userId: string) {
  await connectToDatabase();
  const doc = await MapaSeed.findOne({ userId }).select('mapa').lean();
  return doc?.mapa ?? null;
}

export async function decideMapSuggestion(userId: string, input: unknown): Promise<IMapaData> {
  const body = input as { id?: unknown; action?: unknown; value?: unknown; expectedUpdatedAt?: unknown } | null;
  if (!body || typeof body.id !== 'string' || !['accept', 'dismiss'].includes(String(body.action)) || typeof body.expectedUpdatedAt !== 'string') throw new MapSuggestionError('Decisão inválida.', 400);
  if (body.value !== undefined && (typeof body.value !== 'string' || !body.value.trim() || body.value.length > 200)) throw new MapSuggestionError('Texto inválido.', 400);
  await connectToDatabase();
  const session = await mongoose.startSession();
  let result: IMapaData | null = null;
  try {
    await session.withTransaction(async () => {
      const doc = await MapaSeed.findOne({ userId }).session(session);
      if (!doc) throw new MapSuggestionError('Mapa não encontrado.', 404);
      const suggestion = doc.mapa.suggestions?.find(item => item.id === body.id);
      if (!suggestion) throw new MapSuggestionError('Sugestão não encontrada.', 404);
      if (suggestion.updatedAt !== body.expectedUpdatedAt || !['observing', 'pending'].includes(suggestion.state)) throw new MapSuggestionError('A sugestão mudou. Reabra a narrativa para revisar.', 409);
      const scalar = suggestion.section === 'narrativa_central' || suggestion.section === 'tom';
      if (body.action === 'accept') {
        if (scalar && (doc.mapa[suggestion.section] || null) !== suggestion.previousValue) throw new MapSuggestionError('Sua narrativa foi editada. Reabra a sugestão antes de aceitar.', 409);
        const value = typeof body.value === 'string' ? body.value.trim() : suggestion.value;
        if (scalar) {
          const field = suggestion.section as 'narrativa_central' | 'tom';
          doc.mapa[field] = value;
          const dimension = field === 'narrativa_central' ? 'narrative' : 'tone';
          await Confirmations.updateOne({ userId }, { $set: {
            [`${dimension}.state`]: 'confirmed', [`${dimension}.response`]: 'yes',
            [`${dimension}.confirmedAt`]: new Date(), [`${dimension}.confirmedValue`]: value,
            [`${dimension}.confirmedRevision`]: suggestion.revisions.at(-1), [`${dimension}.valueOrigin`]: 'creator',
          } }, { upsert: true, session });
        } else {
          if (value.length > 100) throw new MapSuggestionError('Use até 100 caracteres para este item.', 400);
          const section = suggestion.section as 'territorios' | 'temas' | 'assets' | 'narrativas_adjacentes' | 'formatos';
          const values = doc.mapa[section];
          if (!values.some(item => item.trim().toLowerCase() === value.toLowerCase())) {
            if (values.length >= 100) throw new MapSuggestionError('Revise os itens desta seção antes de adicionar outro.', 409);
            values.push(value);
          }
          doc.mapa.dismissedChips = doc.mapa.dismissedChips?.filter(item => !(item.section === section && item.label.toLowerCase() === value.toLowerCase()));
        }
        suggestion.state = 'accepted';
      } else suggestion.state = 'dismissed';
      suggestion.updatedAt = new Date().toISOString();
      doc.markModified('mapa');
      await doc.save({ session });
      result = doc.toObject().mapa;
    });
  } finally { await session.endSession(); }
  if (!result) throw new MapSuggestionError('Não foi possível salvar a decisão.', 500);
  return result;
}
