// src/lib/logMediaKitAccess.ts

import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import MediaKitAccessLogModel from '@/app/models/MediaKitAccessLog';
import { logger } from '@/app/lib/logger';

/**
 * Normaliza o IP recebido:
 * - Pega o primeiro IP caso venha "a, b, c" (x-forwarded-for)
 * - Remove prefixo "::ffff:" (IPv6 mapeado p/ IPv4)
 * - Retorna "unknown" se vier vazio/null/undefined
 */
function normalizeIp(ip?: string | null): string {
  const raw = (ip ?? '').trim();
  if (!raw) return 'unknown';
  const first = raw.split(',')[0]?.trim() ?? '';
  const cleaned = first.replace(/^::ffff:/, '').trim();
  return cleaned || 'unknown';
}

/**
 * Registra um acesso ao Media Kit.
 * Assinatura compatível: aceita string (ObjectId) ou Types.ObjectId.
 * Nunca grava IP vazio — usa fallback "unknown".
 */
export async function logMediaKitAccess(
  userId: string | Types.ObjectId,
  ip?: string | null,
  referer?: string | null
): Promise<void> {
  const TAG = '[logMediaKitAccess]';
  try {
    await connectToDatabase();

    // Valida/converte userId de forma segura
    const userObjectId =
      typeof userId === 'string'
        ? (Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null)
        : (userId as Types.ObjectId);

    if (!userObjectId) {
      logger.warn(`${TAG} userId inválido recebido: ${String(userId)}`);
      return;
    }

    const ipSafe = normalizeIp(ip);

    await MediaKitAccessLogModel.create({
      user: userObjectId,
      ip: ipSafe, // garantido não-vazio
      referer: referer ?? undefined,
      timestamp: new Date(),
    });

    logger.debug(
      `${TAG} Logged access. user=${userObjectId.toString()} ip=${ipSafe} referer=${referer ?? '-'}`
    );
  } catch (err: any) {
    logger.error(`${TAG} Failed to log access for user ${String(userId)}: ${err?.message || err}`);
  }
}
