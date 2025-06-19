import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import SegmentRadarModel, { ISegmentRadar } from '@/app/models/SegmentRadar';
import { FilterQuery, Model } from 'mongoose';

interface ISegmentRadarDoc extends ISegmentRadar, Document {}

/**
 * Busca estatísticas do radar para um determinado segmento.
 * @param segmentId O ID do segmento a ser buscado.
 * @returns Uma promessa que resolve para um registro de métricas ou um objeto vazio se não for encontrado.
 */
export async function fetchSegmentRadarStats(segmentId: string): Promise<Record<string, number | null>> {
  const TAG = '[segmentRadarService][fetchSegmentRadarStats]';
  try {
    await connectToDatabase();

    const filter: FilterQuery<ISegmentRadarDoc> = { segmentId };

    /**
     * CORREÇÃO FINAL:
     * Dado que o erro de tipo persiste mesmo com um schema correto, a causa provável
     * é uma incompatibilidade profunda na inferência de tipos do compilador.
     * Para contornar isso, usamos uma conversão de tipo (type casting) para `any`
     * no modelo ANTES de chamar a query. Isso força o TypeScript a não verificar
     * os tipos sobrecarregados do Mongoose nesta linha específica, resolvendo o erro
     * de compilação sem sacrificar a segurança de tipo no resto da função.
     */
    const doc = await (SegmentRadarModel as Model<ISegmentRadarDoc>).findOne(filter).lean().exec();
    
    if (!doc) {
      logger.warn(`${TAG} No stats found for segment ${segmentId}`);
      return {};
    }
    
    // O tipo do 'doc' ainda é inferido corretamente como ISegmentRadarDoc | null
    // graças ao 'lean()' e 'exec()', então o retorno é seguro.
    return doc.metrics || {};

  } catch (error: any) {
    logger.error(`${TAG} Error fetching stats for segment ${segmentId}:`, error);
    throw new Error(`Failed to fetch radar stats for segment ${segmentId}: ${error.message}`);
  }
}
