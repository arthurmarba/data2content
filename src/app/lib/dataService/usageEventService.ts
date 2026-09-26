import { Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import UsageEvent, { UsageEventCategory } from "@/app/models/UsageEvent";

/**
 * Grava um evento de uso no log canônico (fire-and-forget).
 * Nunca lança — falhas de telemetria não podem derrubar o fluxo principal.
 */
export function logUsageEvent(
  userId: Types.ObjectId | string | null | undefined,
  eventName: string,
  category: UsageEventCategory,
  metadata?: Record<string, unknown>
): void {
  if (!userId) return;
  // Evita writes fire-and-forget pendentes sobrevivendo ao teardown de testes
  // (mongoose bufferiza a operação até timeout quando a conexão real é mockada).
  if (process.env.NODE_ENV === "test") return;
  // Testes de ponta a ponta com contas fictícias no banco real não gravam uso.
  if (process.env.USAGE_EVENTS_DISABLED === "1") return;

  void (async () => {
    try {
      await connectToDatabase();
      await UsageEvent.create({ userId, eventName, category, metadata });
    } catch (error) {
      logger.warn(`[usageEventService] Falha ao gravar UsageEvent '${eventName}' para user ${userId}.`, error);
    }
  })();
}
