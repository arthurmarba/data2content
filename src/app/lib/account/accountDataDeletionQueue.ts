import { Client } from "@upstash/qstash";
import { Types } from "mongoose";
import { logger } from "@/app/lib/logger";

/**
 * Manda para a fila a limpeza dos dados de uma conta já excluída. Se a fila
 * falhar, a conta continua excluída; o comando scripts/accountDataOrphans.ts
 * acha o que ficou para trás.
 */
export async function enqueueAccountDataDeletion(userId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(userId)) return false;
  const token = process.env.QSTASH_TOKEN;
  const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!token || !/^https?:\/\//.test(baseUrl)) return false;
  try {
    await new Client({ token }).publishJSON({
      url: `${baseUrl}/api/worker/delete-account-data`,
      body: { userId },
      retries: 3,
      deduplicationId: `account-data-deletion-${userId}`,
    });
    return true;
  } catch (error) {
    logger.warn("[account.delete][data_queue_failed]", { userId, error: String(error) });
    return false;
  }
}
