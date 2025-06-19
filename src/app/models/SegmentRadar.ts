import { Schema, model, models, Document } from 'mongoose';

/**
 * A interface ISegmentRadar define a estrutura de um documento SegmentRadar.
 * A propriedade 'metrics' é um objeto onde as chaves são strings e os
 * valores são números ou nulos.
 */
export interface ISegmentRadar extends Document {
  segmentId: string;
  metrics: Record<string, number | null>;
}

/**
 * Schema do Mongoose para SegmentRadar.
 *
 * CORREÇÃO: Para permitir que os valores do mapa sejam 'number' ou 'null',
 * precisamos usar 'Schema.Types.Mixed'. Isso resolve a incompatibilidade
 * entre a interface (que permite null) e a definição do schema, que é a
 * causa provável do erro de tipo na chamada do serviço.
 */
const segmentRadarSchema = new Schema<ISegmentRadar>({
  segmentId: { type: String, required: true, index: true },
  metrics: {
    type: Map,
    of: Schema.Types.Mixed, // Use Mixed para permitir valores `number` ou `null`.
    required: true,
  },
});

/**
 * Exporta o modelo. Usa o modelo existente se já tiver sido compilado (padrão do Next.js)
 * para evitar erros durante o hot-reloading em desenvolvimento.
 */
export default models.SegmentRadar || model<ISegmentRadar>('SegmentRadar', segmentRadarSchema);
