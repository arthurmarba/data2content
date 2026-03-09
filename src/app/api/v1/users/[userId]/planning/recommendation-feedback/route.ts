import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dashboardCache } from "@/app/lib/cache/dashboardCache";
import { connectToDatabase } from "@/app/lib/dataService/connection";
import { logger } from "@/app/lib/logger";
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from "@/app/lib/mongoTransient";
import PlanningRecommendationFeedbackModel from "@/app/models/PlanningRecommendationFeedback";
import { ALLOWED_PLANNING_OBJECTIVES, PlanningObjectiveMode } from "@/utils/buildPlanningRecommendations";
import { ALLOWED_TIME_PERIODS, TimePeriod } from "@/app/lib/constants/timePeriods";

type FeedbackStatus = "applied" | "not_applied" | "clear";

const SERVICE_TAG = "[api/v1/users/planning/recommendation-feedback]";
const DEFAULT_TIME_PERIOD: TimePeriod = "last_90_days";
const FEEDBACK_CACHE_TTL_MS = 60_000;
const FEEDBACK_FALLBACK_TTL_MS = 10 * 60_000;

type RecommendationFeedbackResponse = {
  objectiveMode: PlanningObjectiveMode;
  timePeriod: TimePeriod;
  feedbackByActionId: Record<string, "applied" | "not_applied">;
  feedbackMetaByActionId: Record<string, { status: "applied" | "not_applied"; updatedAt: string | null }>;
};

function buildFeedbackCacheKey(userId: string, objectiveMode: PlanningObjectiveMode, timePeriod: TimePeriod) {
  return `${SERVICE_TAG}:${userId}:${objectiveMode}:${timePeriod}`;
}

function buildEmptyFeedbackResponse(
  objectiveMode: PlanningObjectiveMode,
  timePeriod: TimePeriod
): RecommendationFeedbackResponse {
  return {
    objectiveMode,
    timePeriod,
    feedbackByActionId: {},
    feedbackMetaByActionId: {},
  };
}

function clearFeedbackCaches(userId: string, objectiveMode: PlanningObjectiveMode, timePeriod: TimePeriod) {
  const cacheKey = buildFeedbackCacheKey(userId, objectiveMode, timePeriod);
  dashboardCache.clear(cacheKey);
  dashboardCache.clear(`${cacheKey}:fallback`);
}

function isAllowedPlanningObjective(value: unknown): value is PlanningObjectiveMode {
  return ALLOWED_PLANNING_OBJECTIVES.includes(value as PlanningObjectiveMode);
}

function isAllowedTimePeriod(value: unknown): value is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(value as TimePeriod);
}

function normalizeActionId(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw.replace(/[^a-z0-9_:-]/g, "").slice(0, 80);
}

function splitActionKey(actionId: string): { actionBaseId: string | null; actionVariant: string | null } {
  const normalized = normalizeActionId(actionId);
  if (!normalized) return { actionBaseId: null, actionVariant: null };
  const [base, ...variantParts] = normalized.split(":");
  const actionBaseId = base || null;
  const actionVariant = variantParts.length ? variantParts.join(":") : null;
  return { actionBaseId, actionVariant };
}

function normalizeStatus(value: unknown): FeedbackStatus | null {
  if (value === "applied" || value === "not_applied" || value === "clear") return value;
  return null;
}

function getSessionUser(session: any) {
  return {
    id: String(session?.user?.id || ""),
    role: String(session?.user?.role || ""),
  };
}

function canAccessUser(sessionUserId: string, sessionRole: string, targetUserId: string) {
  if (!sessionUserId) return false;
  if (sessionUserId === targetUserId) return true;
  return sessionRole === "admin";
}

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "User ID inválido." }, { status: 400 });
  }

  const session = (await getServerSession(authOptions)) as any;
  const sessionUser = getSessionUser(session);
  if (!sessionUser.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!canAccessUser(sessionUser.id, sessionUser.role, userId)) {
    return NextResponse.json({ error: "Sem permissão para este usuário." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const objectiveModeParam = searchParams.get("objectiveMode");
  const timePeriodParam = searchParams.get("timePeriod");

  const objectiveMode: PlanningObjectiveMode = isAllowedPlanningObjective(objectiveModeParam)
    ? objectiveModeParam
    : "engagement";
  if (objectiveModeParam && !isAllowedPlanningObjective(objectiveModeParam)) {
    return NextResponse.json(
      { error: `objectiveMode inválido. Permitidos: ${ALLOWED_PLANNING_OBJECTIVES.join(", ")}` },
      { status: 400 }
    );
  }

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam)
    ? timePeriodParam
    : DEFAULT_TIME_PERIOD;
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json(
      { error: `timePeriod inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const cacheKey = buildFeedbackCacheKey(userId, objectiveMode, timePeriod);
    const rows = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return PlanningRecommendationFeedbackModel.find({
          userId: new Types.ObjectId(userId),
          objectiveMode,
          timePeriod,
        })
          .select("actionId status updatedAt")
          .lean();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn(`${SERVICE_TAG} GET falha transitória ao buscar feedback de ${userId}. Retry #${retryCount}.`, {
            error: getErrorMessage(error),
          });
        },
      }
    );

    const payload = rows.reduce<RecommendationFeedbackResponse>((acc, row: any) => {
      const actionId = normalizeActionId(row?.actionId);
      const status = row?.status;
      if (!actionId || (status !== "applied" && status !== "not_applied")) return acc;
      acc.feedbackByActionId[actionId] = status;
      acc.feedbackMetaByActionId[actionId] = {
        status,
        updatedAt: row?.updatedAt instanceof Date ? row.updatedAt.toISOString() : row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      };
      return acc;
    }, buildEmptyFeedbackResponse(objectiveMode, timePeriod));

    const fallbackCacheKey = `${cacheKey}:fallback`;
    dashboardCache.set(cacheKey, payload, FEEDBACK_CACHE_TTL_MS);
    dashboardCache.set(fallbackCacheKey, payload, FEEDBACK_FALLBACK_TTL_MS);

    return NextResponse.json(payload);
  } catch (error: any) {
    const cacheKey = buildFeedbackCacheKey(userId, objectiveMode, timePeriod);
    const fallbackCacheKey = `${cacheKey}:fallback`;
    const fallback = dashboardCache.get<RecommendationFeedbackResponse>(fallbackCacheKey)?.value;
    if (isTransientMongoError(error) || isTransientMongoError(error?.cause)) {
      logger.warn(`${SERVICE_TAG} GET erro transitório para user ${userId}. Retornando fallback.`, {
        error: getErrorMessage(error),
        hasCachedFallback: Boolean(fallback),
      });
      const response = NextResponse.json(
        fallback ?? buildEmptyFeedbackResponse(objectiveMode, timePeriod),
        { status: 200 }
      );
      response.headers.set("X-D2C-Fallback", fallback ? "cached-feedback" : "empty-feedback");
      return response;
    }
    logger.error(`${SERVICE_TAG} GET error for user ${userId}:`, error);
    return NextResponse.json(
      { error: "Erro ao buscar feedback das recomendações.", details: error?.message || "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "User ID inválido." }, { status: 400 });
  }

  const session = (await getServerSession(authOptions)) as any;
  const sessionUser = getSessionUser(session);
  if (!sessionUser.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!canAccessUser(sessionUser.id, sessionUser.role, userId)) {
    return NextResponse.json({ error: "Sem permissão para este usuário." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const objectiveModeRaw = body?.objectiveMode;
    const timePeriodRaw = body?.timePeriod;
    const actionIdRaw = body?.actionId;
    const statusRaw = body?.status;

    if (!isAllowedPlanningObjective(objectiveModeRaw)) {
      return NextResponse.json(
        { error: `objectiveMode inválido. Permitidos: ${ALLOWED_PLANNING_OBJECTIVES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!isAllowedTimePeriod(timePeriodRaw)) {
      return NextResponse.json(
        { error: `timePeriod inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(", ")}` },
        { status: 400 }
      );
    }

    const actionId = normalizeActionId(actionIdRaw);
    if (!actionId) {
      return NextResponse.json({ error: "actionId inválido." }, { status: 400 });
    }
    const { actionBaseId, actionVariant } = splitActionKey(actionId);

    const status = normalizeStatus(statusRaw);
    if (!status) {
      return NextResponse.json({ error: "status inválido. Permitidos: applied, not_applied, clear." }, { status: 400 });
    }

    const filter = {
      userId: new Types.ObjectId(userId),
      objectiveMode: objectiveModeRaw,
      timePeriod: timePeriodRaw,
      actionId,
    };

    if (status === "clear") {
      await withMongoTransientRetry(
        async () => {
          await connectToDatabase();
          await PlanningRecommendationFeedbackModel.deleteOne(filter);
        },
        {
          retries: 1,
          onRetry: (error, retryCount) => {
            logger.warn(`${SERVICE_TAG} POST falha transitória ao limpar feedback de ${userId}. Retry #${retryCount}.`, {
              error: getErrorMessage(error),
            });
          },
        }
      );
      clearFeedbackCaches(userId, objectiveModeRaw, timePeriodRaw);
      return NextResponse.json({
        ok: true,
        removed: true,
        actionId,
      });
    }

    const actionTitle = typeof body?.actionTitle === "string" ? body.actionTitle.trim().slice(0, 180) : null;
    const confidence =
      body?.confidence === "high" || body?.confidence === "medium" || body?.confidence === "low"
        ? body.confidence
        : null;
    const opportunityScore =
      typeof body?.opportunityScore === "number" && Number.isFinite(body.opportunityScore)
        ? body.opportunityScore
        : null;
    const sampleSize =
      typeof body?.sampleSize === "number" && Number.isFinite(body.sampleSize)
        ? Math.max(0, Math.round(body.sampleSize))
        : null;

    const updated = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return PlanningRecommendationFeedbackModel.findOneAndUpdate(
          filter,
          {
            $set: {
              status,
              actionBaseId,
              actionVariant,
              actionTitle,
              confidence,
              opportunityScore,
              sampleSize,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        )
          .select("actionId status updatedAt")
          .lean();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn(`${SERVICE_TAG} POST falha transitória ao salvar feedback de ${userId}. Retry #${retryCount}.`, {
            error: getErrorMessage(error),
          });
        },
      }
    );
    clearFeedbackCaches(userId, objectiveModeRaw, timePeriodRaw);

    return NextResponse.json({
      ok: true,
      item: updated,
    });
  } catch (error: any) {
    logger.error(`${SERVICE_TAG} POST error for user ${userId}:`, error);
    return NextResponse.json(
      { error: "Erro ao salvar feedback da recomendação.", details: error?.message || "Erro desconhecido" },
      { status: 500 }
    );
  }
}
