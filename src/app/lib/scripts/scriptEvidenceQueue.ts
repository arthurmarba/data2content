import { Client } from "@upstash/qstash";
import { Types } from "mongoose";
import { logger } from "@/app/lib/logger";

/** Enfileira manutenção barata; nunca relê mídia nem impede o salvamento do criador. */
export async function enqueueScriptEvidenceMaintenance(userId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(userId)) return false;
  const token = process.env.QSTASH_TOKEN;
  const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!token || !/^https?:\/\//.test(baseUrl)) return false;
  try {
    await new Client({ token }).publishJSON({
      url: `${baseUrl}/api/worker/refresh-script-evidence`,
      body: { userId }, retries: 2, delay: 15,
      deduplicationId: `script-evidence-event-${userId}-${Math.floor(Date.now() / 60000)}`,
    });
    return true;
  } catch (error) {
    logger.warn("[scripts][evidence][maintenance_queue_failed]", { userId, error: String(error) });
    return false;
  }
}
