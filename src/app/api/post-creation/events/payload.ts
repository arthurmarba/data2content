import { Types } from "mongoose";

import {
  POST_CREATION_FUNNEL_EVENT_NAMES,
  POST_CREATION_FUNNEL_STAGES,
  POST_CREATION_FUNNEL_STEPS,
  POST_CREATION_IDEA_LANES,
  POST_CREATION_SCRIPT_STATUSES,
} from "@/app/models/PostCreationFunnelEvent";

function normalizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function normalizePostCreationEventBody(body: any) {
  const eventName = POST_CREATION_FUNNEL_EVENT_NAMES.includes(body?.eventName)
    ? body.eventName
    : null;
  const stage = POST_CREATION_FUNNEL_STAGES.includes(body?.stage) ? body.stage : null;
  const step = POST_CREATION_FUNNEL_STEPS.includes(body?.step) ? body.step : null;
  const lane = POST_CREATION_IDEA_LANES.includes(body?.lane) ? body.lane : null;
  const scriptStatus = POST_CREATION_SCRIPT_STATUSES.includes(body?.scriptStatus)
    ? body.scriptStatus
    : null;
  const confidence = Number(body?.confidence);

  return {
    eventName,
    stage,
    step,
    lane,
    scriptStatus,
    draftId:
      typeof body?.draftId === "string" && Types.ObjectId.isValid(body.draftId)
        ? body.draftId
        : null,
    slotId: normalizeString(body?.slotId, 120),
    scriptId: normalizeString(body?.scriptId, 120),
    ideaId: normalizeString(body?.ideaId, 160),
    contentId: normalizeString(body?.contentId, 120),
    source: normalizeString(body?.source, 120),
    recommendedSelected: typeof body?.recommendedSelected === "boolean" ? body.recommendedSelected : null,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    metadata:
      body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {},
    targetUserId: typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "",
  };
}

export function buildPostCreationEventCreatePayload(
  normalized: ReturnType<typeof normalizePostCreationEventBody>,
  userId: string
) {
  const createPayload: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
    draftId: normalized.draftId ? new Types.ObjectId(normalized.draftId) : null,
    eventName: normalized.eventName,
    stage: normalized.stage,
    slotId: normalized.slotId,
    scriptId: normalized.scriptId,
    ideaId: normalized.ideaId,
    contentId: normalized.contentId,
    source: normalized.source,
    recommendedSelected: normalized.recommendedSelected,
    confidence: normalized.confidence,
    metadata: normalized.metadata,
  };

  if (normalized.step) {
    createPayload.step = normalized.step;
  }

  if (normalized.lane) {
    createPayload.lane = normalized.lane;
  }

  if (normalized.scriptStatus) {
    createPayload.scriptStatus = normalized.scriptStatus;
  }

  return createPayload;
}
