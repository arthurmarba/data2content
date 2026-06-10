// src/app/lib/instagram/enqueueInstagramRefresh.ts
//
// Enfileira (via QStash) o worker de refresh do Instagram — que sincroniza os
// dados da conta E enriquece o MapaSeed com a leitura visual do Gemini
// (enrichMapaSeedWithInstagram). Disparado ao conectar a conta (Fase 2B), para
// que o mapa enriqueça imediatamente em vez de esperar a cron periódica.
//
// Degradação graciosa: se QSTASH_TOKEN ou a URL base não estiverem configurados,
// apenas loga e retorna — a cron `refresh-instagram-data` ainda cobre o usuário
// depois. Best-effort: nunca lança, nunca bloqueia a resposta da conexão.

import { Client } from "@upstash/qstash";
import { logger } from "@/app/lib/logger";

const TAG = "[enqueueInstagramRefresh]";

const qstashToken = process.env.QSTASH_TOKEN;
let qstashClient: Client | null = null;
if (qstashToken) {
  try {
    qstashClient = new Client({ token: qstashToken });
  } catch (err) {
    logger.error(`${TAG} Falha ao inicializar cliente QStash:`, err);
  }
}

// Mesma construção de URL usada pela cron refresh-instagram-data, para apontar
// ao mesmo worker sem exigir um env dedicado.
function resolveWorkerUrl(): string | null {
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!base || !base.startsWith("http")) return null;
  return `${base.replace(/\/$/, "")}/api/worker/refresh-instagram-user`;
}

export async function enqueueInstagramRefresh(userId: string): Promise<void> {
  const workerUrl = resolveWorkerUrl();

  if (!qstashClient || !workerUrl) {
    logger.warn(
      `${TAG} QStash não configurado (token=${!!qstashClient}, url=${!!workerUrl}). Refresh on-connect não enfileirado para userId=${userId}.`,
    );
    return;
  }

  try {
    const response = await qstashClient.publishJSON({
      url: workerUrl,
      body: { userId },
    });
    logger.info(
      `${TAG} Refresh de Instagram enfileirado on-connect para userId=${userId}. Message ID: ${response.messageId}`,
    );
  } catch (err) {
    // Non-fatal: a cron periódica ainda enriquece o usuário depois.
    logger.error(`${TAG} Falha ao enfileirar refresh on-connect para userId=${userId} (ignorada):`, err);
  }
}
