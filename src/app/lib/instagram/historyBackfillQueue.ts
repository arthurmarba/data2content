// Fila do histórico antigo do Instagram (ver sync/historyBackfill.ts).
//
// O worker roda um passo por mensagem e esta camada decide o que vem depois:
// continuar de onde parou, esperar o Instagram liberar ou encerrar. Best-effort
// na conexão: nunca lança para quem enfileira.

import { Client } from '@upstash/qstash';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';
import {
  needsHistoryBackfill,
  runInstagramHistoryBackfillStep,
  type HistoryBackfillStepResult,
} from './sync/historyBackfill';

const TAG = '[instagramHistoryBackfillQueue]';
/** Pausa entre passos seguidos: alivia o limite de chamadas por hora do Instagram. */
const CONTINUE_DELAY_SECONDS = 30;
/** Limite de uso do Instagram volta por hora. */
const RATE_LIMIT_DELAY_SECONDS = 3_600;
/** Um dia de tentativas; depois disso o histórico fica marcado como falho. */
const MAX_RATE_LIMIT_ATTEMPTS = 24;

export interface HistoryBackfillJobPayload {
  userId: string;
  after?: string | null;
  attempt?: number;
}

const qstashToken = process.env.QSTASH_TOKEN;
const qstashClient = qstashToken ? new Client({ token: qstashToken }) : null;

function resolveWorkerUrl(): string | null {
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!base || !base.startsWith('http')) return null;
  return `${base.replace(/\/$/, '')}/api/worker/instagram-history-backfill`;
}

export async function enqueueInstagramHistoryBackfill(
  payload: HistoryBackfillJobPayload,
  delaySeconds = 0,
): Promise<boolean> {
  const url = resolveWorkerUrl();
  if (!qstashClient || !url) {
    logger.warn(`${TAG} QStash não configurado; histórico de ${payload.userId} não enfileirado.`);
    return false;
  }
  try {
    await qstashClient.publishJSON({ url, body: payload, ...(delaySeconds > 0 ? { delay: delaySeconds } : {}) });
    return true;
  } catch (error) {
    logger.error(`${TAG} Falha ao enfileirar histórico de ${payload.userId}:`, error);
    return false;
  }
}

/** Chamado na conexão: começa o histórico se esta conta ainda não o tem. */
export async function startInstagramHistoryBackfillIfNeeded(userId: string): Promise<boolean> {
  try {
    await connectToDatabase();
    const user = await DbUser.findById(new Types.ObjectId(userId))
      .select('instagramAccountId instagramHistoryBackfill')
      .lean<{ instagramAccountId?: string | null; instagramHistoryBackfill?: { status?: string | null; instagramAccountId?: string | null } } | null>();
    if (!user?.instagramAccountId) return false;
    if (!needsHistoryBackfill(user.instagramHistoryBackfill, user.instagramAccountId)) return false;
    return enqueueInstagramHistoryBackfill({ userId });
  } catch (error) {
    logger.error(`${TAG} Falha não fatal ao iniciar histórico de ${userId}:`, error);
    return false;
  }
}

/** Um passo e a decisão do próximo. */
export async function processInstagramHistoryBackfillJob(
  payload: HistoryBackfillJobPayload,
): Promise<HistoryBackfillStepResult> {
  const result = await runInstagramHistoryBackfillStep({ userId: payload.userId, after: payload.after });

  if (result.status === 'continue') {
    await enqueueInstagramHistoryBackfill({ userId: payload.userId, after: result.after, attempt: 0 }, CONTINUE_DELAY_SECONDS);
  } else if (result.status === 'rate_limited') {
    const attempt = (payload.attempt ?? 0) + 1;
    if (attempt <= MAX_RATE_LIMIT_ATTEMPTS) {
      await enqueueInstagramHistoryBackfill({ userId: payload.userId, after: result.after, attempt }, RATE_LIMIT_DELAY_SECONDS);
    } else {
      await DbUser.updateOne({ _id: new Types.ObjectId(payload.userId) }, { $set: {
        'instagramHistoryBackfill.status': 'failed',
        'instagramHistoryBackfill.finishedAt': new Date(),
        'instagramHistoryBackfill.lastError': 'Instagram manteve o limite de chamadas por 24 tentativas.',
      } });
    }
  }
  return result;
}
