import { Types } from "mongoose";

import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import PostCreationFunnelEvent, {
  type PostCreationFunnelEventName,
  type PostCreationFunnelStageName,
} from "@/app/models/PostCreationFunnelEvent";

export async function recordPostCreationFunnelEvent(params: {
  userId?: string | null;
  eventName: PostCreationFunnelEventName;
  stage?: PostCreationFunnelStageName;
  source?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!params.userId || !Types.ObjectId.isValid(params.userId)) return;

  try {
    await connectToDatabase();
    await PostCreationFunnelEvent.create({
      userId: new Types.ObjectId(params.userId),
      eventName: params.eventName,
      stage: params.stage ?? "path",
      source: params.source ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (error) {
    logger.warn("[post-creation/events] Falha ao registrar evento do funil.", {
      userId: params.userId,
      eventName: params.eventName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
