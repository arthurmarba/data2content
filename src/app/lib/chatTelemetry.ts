import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import ChatSessionModel, { type IChatSession } from "@/app/models/ChatSession";
import ChatMessageLogModel from "@/app/models/ChatMessageLog";
import ChatMessageFeedbackModel from "@/app/models/ChatMessageFeedback";
import ChatSessionFeedbackModel from "@/app/models/ChatSessionFeedback";
import ChatSessionReviewModel from "@/app/models/ChatSessionReview";
import { logger } from "@/app/lib/logger";

const INACTIVITY_MS = 20 * 60 * 1000; // 20 minutos
const NEGATIVE_REASON_CODES = [
  "generic",
  "wrong",
  "didnt_use_context",
  "hard_to_follow",
  "too_long",
  "too_short",
  "slow",
  "other",
] as const;
const REASON_TO_CATEGORY: Record<string, string> = {
  generic: "resposta_generica",
  wrong: "resposta_errada",
  didnt_use_context: "nao_usou_contexto",
  hard_to_follow: "confuso",
  too_long: "muito_longo",
  too_short: "raso",
  slow: "lento",
  other: "outros",
};
const maskPIIString = (text: string) => {
  if (!text) return text;
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d{1,3}?[\s.-]?\(?\d{2,3}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}/g, "[phone]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]");
};

const maskPIIObject = (value: any): any => {
  if (!value) return value;
  if (typeof value === "string") return maskPIIString(value);
  if (Array.isArray(value)) return value.map(maskPIIObject);
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    Object.entries(value).forEach(([k, v]) => {
      out[k] = maskPIIObject(v);
    });
    return out;
  }
  return value;
};

function pickCategoryFromReasons(reasons?: string[] | null) {
  if (!reasons || !reasons.length) return null;
  const normalized = reasons.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean);
  for (const reason of normalized) {
    const mapped = REASON_TO_CATEGORY[reason];
    if (mapped) return mapped;
  }
  return "outros";
}

function deriveSeverityFromSignals(input: { csat?: number | null; rating?: "up" | "down" }) {
  if (typeof input.csat === "number") {
    if (input.csat <= 2) return 3;
    if (input.csat <= 3) return 2;
  }
  if (input.rating === "down") return 2;
  return null;
}

async function ensureAutoReview(params: {
  sessionId?: string | null;
  reasons?: string[] | null;
  csat?: number | null;
  rating?: "up" | "down";
  source: "thumbs_down" | "csat_low";
}) {
  if (!params.sessionId) return;
  try {
    await connectToDatabase();
    const sessionObjectId = new Types.ObjectId(params.sessionId);
    const existing = await ChatSessionReviewModel.findOne({ sessionId: sessionObjectId }).lean();
    if (existing && !existing.isAuto) {
      return; // não sobrescreve revisão humana
    }
    const category = pickCategoryFromReasons(params.reasons);
    const severity = deriveSeverityFromSignals({ csat: params.csat, rating: params.rating });
    if (!category && !severity) return;
    const update: any = {
      status: "new",
      isAuto: true,
      autoReason: params.source,
    };
    if (category) update.category = category;
    if (severity) update.severity = severity;
    await ChatSessionReviewModel.findOneAndUpdate(
      { sessionId: sessionObjectId },
      { $set: update, $setOnInsert: { sessionId: sessionObjectId } },
      { upsert: true, new: true }
    );
  } catch (error) {
    logger.error("[chatTelemetry] Failed to auto-create review", error);
  }
}

type EnsureSessionInput = {
  userId: string;
  threadId?: string | null;
  sourcePage?: string | null;
  userSurveySnapshot?: Record<string, any> | null;
  surveySchemaVersion?: string | null;
  model?: string | null;
  modelVersion?: string | null;
  promptVariant?: string | null;
  experimentId?: string | null;
  ragEnabled?: boolean | null;
  contextSourcesUsed?: string[] | null;
};

export async function ensureChatSession(input: EnsureSessionInput): Promise<IChatSession> {
  await connectToDatabase();
  const query: Record<string, any> = {
    userId: new Types.ObjectId(input.userId),
    threadId: input.threadId ? new Types.ObjectId(input.threadId) : null,
    endedAt: null,
  };

  const existing = await ChatSessionModel.findOne(query).lean<IChatSession | null>();
  if (existing) {
    const last = existing.lastActivityAt ? new Date(existing.lastActivityAt) : null;
    if (last && Date.now() - last.getTime() > INACTIVITY_MS) {
      await ChatSessionModel.findByIdAndUpdate(existing._id, {
        endedAt: new Date(),
        endReason: "inactive_timeout",
        lastActivityAt: new Date(),
      });
    } else {
      const update: any = { lastActivityAt: new Date() };
      if (input.promptVariant && !existing.promptVariant) update.promptVariant = input.promptVariant;
      if (input.experimentId && !existing.experimentId) update.experimentId = input.experimentId;
      if (typeof input.ragEnabled === "boolean" && typeof existing.ragEnabled !== "boolean") update.ragEnabled = input.ragEnabled;
      if (Array.isArray(input.contextSourcesUsed) && !existing.contextSourcesUsed) update.contextSourcesUsed = input.contextSourcesUsed;
      const updated = await ChatSessionModel.findByIdAndUpdate(existing._id, update, { new: true }).lean<IChatSession | null>();
      return updated || { ...existing, ...update };
    }
  }

  const createPayload: any = {
    userId: query.userId,
    threadId: query.threadId,
    sourcePage: input.sourcePage || null,
    userSurveySnapshot: input.userSurveySnapshot ? maskPIIObject(input.userSurveySnapshot) : null,
    surveySchemaVersion: input.surveySchemaVersion || null,
    model: input.model || null,
    modelVersion: input.modelVersion || null,
    promptVariant: input.promptVariant || null,
    experimentId: input.experimentId || null,
    ragEnabled: typeof input.ragEnabled === "boolean" ? input.ragEnabled : null,
    contextSourcesUsed: Array.isArray(input.contextSourcesUsed) ? input.contextSourcesUsed : null,
    startedAt: new Date(),
    lastActivityAt: new Date(),
  };

  return ChatSessionModel.create(createPayload);
}

export async function logChatMessage(params: {
  sessionId: string;
  userId: string;
  threadId?: string | null;
  messageId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string | null;
  confidence?: number | null;
  llmLatencyMs?: number | null;
  totalLatencyMs?: number | null;
  tokensEstimatedIn?: number | null;
  tokensEstimatedOut?: number | null;
  tokensActualIn?: number | null;
  tokensActualOut?: number | null;
  hadFallback?: boolean | null;
  fallbackReason?: string | null;
  errorType?: string | null;
  httpStatus?: number | null;
  wasStreamed?: boolean | null;
  promptVariant?: string | null;
  experimentId?: string | null;
  modelVersion?: string | null;
  ragEnabled?: boolean | null;
  contextSourcesUsed?: string[] | null;
}) {
  const safeContent = maskPIIString(params.content);

  try {
    await connectToDatabase();
    if (!params.messageId) {
      await ChatMessageLogModel.create({
        sessionId: new Types.ObjectId(params.sessionId),
        userId: new Types.ObjectId(params.userId),
        threadId: params.threadId ? new Types.ObjectId(params.threadId) : null,
        role: params.role,
        content: safeContent,
        intent: params.intent ?? null,
        confidence: params.confidence ?? null,
        llmLatencyMs: params.llmLatencyMs ?? null,
        totalLatencyMs: params.totalLatencyMs ?? null,
        tokensEstimatedIn: params.tokensEstimatedIn ?? null,
        tokensEstimatedOut: params.tokensEstimatedOut ?? null,
        tokensActualIn: params.tokensActualIn ?? null,
        tokensActualOut: params.tokensActualOut ?? null,
        hadFallback: params.hadFallback ?? null,
        fallbackReason: params.fallbackReason ?? null,
        errorType: params.errorType ?? null,
        httpStatus: params.httpStatus ?? null,
        wasStreamed: params.wasStreamed ?? null,
        promptVariant: params.promptVariant ?? null,
        experimentId: params.experimentId ?? null,
        modelVersion: params.modelVersion ?? null,
        ragEnabled: params.ragEnabled ?? null,
        contextSourcesUsed: params.contextSourcesUsed ?? null,
      });
    } else {
      await ChatMessageLogModel.findOneAndUpdate(
        {
          sessionId: new Types.ObjectId(params.sessionId),
          messageId: params.messageId,
        },
        {
          $setOnInsert: {
            sessionId: new Types.ObjectId(params.sessionId),
            userId: new Types.ObjectId(params.userId),
            threadId: params.threadId ? new Types.ObjectId(params.threadId) : null,
            role: params.role,
            content: safeContent,
            messageId: params.messageId,
          },
          $set: {
            intent: params.intent ?? null,
            confidence: params.confidence ?? null,
            llmLatencyMs: params.llmLatencyMs ?? null,
            totalLatencyMs: params.totalLatencyMs ?? null,
            tokensEstimatedIn: params.tokensEstimatedIn ?? null,
            tokensEstimatedOut: params.tokensEstimatedOut ?? null,
            tokensActualIn: params.tokensActualIn ?? null,
            tokensActualOut: params.tokensActualOut ?? null,
            hadFallback: params.hadFallback ?? null,
            fallbackReason: params.fallbackReason ?? null,
            errorType: params.errorType ?? null,
            httpStatus: params.httpStatus ?? null,
            wasStreamed: params.wasStreamed ?? null,
            promptVariant: params.promptVariant ?? null,
            experimentId: params.experimentId ?? null,
            modelVersion: params.modelVersion ?? null,
            ragEnabled: params.ragEnabled ?? null,
            contextSourcesUsed: params.contextSourcesUsed ?? null,
          },
        },
        { upsert: true }
      );
    }
    await ChatSessionModel.findByIdAndUpdate(params.sessionId, { lastActivityAt: new Date() });
  } catch (error) {
    logger.error("[chatTelemetry] Failed to log chat message", error);
  }
}

export async function recordMessageFeedback(params: {
  sessionId?: string | null;
  messageId?: string | null;
  rating: "up" | "down";
  reason?: string | null;
  reasonCode?: string | null;
  reasonDetail?: string | null;
  userId?: string | null;
}) {
  try {
    await connectToDatabase();
    const reasonCode = params.reasonCode && NEGATIVE_REASON_CODES.includes(params.reasonCode as any) ? params.reasonCode : null;
    const reasonText =
      typeof params.reasonDetail === "string"
        ? maskPIIString(params.reasonDetail)
        : typeof params.reason === "string"
          ? maskPIIString(params.reason)
          : null;
    await ChatMessageFeedbackModel.findOneAndUpdate(
      {
        sessionId: params.sessionId ? new Types.ObjectId(params.sessionId) : null,
        messageId: params.messageId || null,
        userId: params.userId ? new Types.ObjectId(params.userId) : null,
      },
      {
        rating: params.rating,
        reason: reasonText || null,
        reasonCode,
        reasonDetail: reasonText || null,
      },
      { upsert: true }
    );
    if (params.rating === "down") {
      const reasons = reasonCode ? [reasonCode] : params.reason ? [params.reason] : null;
      await ensureAutoReview({
        sessionId: params.sessionId || null,
        reasons,
        rating: params.rating,
        source: "thumbs_down",
      });
    }
  } catch (error) {
    logger.error("[chatTelemetry] Failed to record message feedback", error);
  }
}

export async function recordSessionFeedback(params: {
  sessionId: string;
  csat: number;
  comment?: string | null;
  userId?: string | null;
  endReason?: string | null;
  reasons?: string[] | null;
}) {
  try {
    await connectToDatabase();
    const reasons = Array.isArray(params.reasons) ? params.reasons.filter(Boolean) : null;
    await ChatSessionFeedbackModel.findOneAndUpdate(
      {
        sessionId: new Types.ObjectId(params.sessionId),
        userId: params.userId ? new Types.ObjectId(params.userId) : null,
      },
      {
        csat: params.csat,
        comment: params.comment || null,
        reasons: reasons && reasons.length ? reasons : null,
      },
      { upsert: true }
    );
    await ChatSessionModel.findByIdAndUpdate(params.sessionId, {
      endedAt: new Date(),
      endReason: params.endReason || "csat_submitted",
      lastActivityAt: new Date(),
      csatSubmitted: true,
    });
    if (params.csat <= 3) {
      await ensureAutoReview({
        sessionId: params.sessionId,
        csat: params.csat,
        reasons,
        rating: "down",
        source: "csat_low",
      });
    }
  } catch (error) {
    logger.error("[chatTelemetry] Failed to record session feedback", error);
  }
}

export async function markCsatPrompted(sessionId: string) {
  try {
    await connectToDatabase();
    await ChatSessionModel.findByIdAndUpdate(sessionId, { csatPromptedAt: new Date() });
  } catch (error) {
    logger.error("[chatTelemetry] Failed to mark csatPromptedAt", error);
  }
}

export async function closeChatSession(params: { sessionId: string; reason: string }) {
  try {
    await connectToDatabase();
    await ChatSessionModel.findByIdAndUpdate(params.sessionId, {
      endedAt: new Date(),
      endReason: params.reason,
      lastActivityAt: new Date(),
    });
  } catch (error) {
    logger.error("[chatTelemetry] Failed to close chat session", error);
  }
}
