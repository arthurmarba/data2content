import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/dataService/connection";
import { logger } from "@/app/lib/logger";
import PlanningRecommendationFeedbackModel from "@/app/models/PlanningRecommendationFeedback";
import { ALLOWED_PLANNING_OBJECTIVES, PlanningObjectiveMode } from "@/utils/buildPlanningRecommendations";
import { ALLOWED_TIME_PERIODS, TimePeriod } from "@/app/lib/constants/timePeriods";

type FeedbackStatus = "applied" | "not_applied" | "clear";

const SERVICE_TAG = "[api/v1/users/planning/recommendation-feedback]";
const DEFAULT_TIME_PERIOD: TimePeriod = "last_90_days";

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
    await connectToDatabase();

    const rows = await PlanningRecommendationFeedbackModel.find({
      userId: new Types.ObjectId(userId),
      objectiveMode,
      timePeriod,
    })
      .select("actionId status updatedAt")
      .lean();

    const feedbackByActionId = rows.reduce<Record<string, "applied" | "not_applied">>((acc, row: any) => {
      const actionId = normalizeActionId(row?.actionId);
      const status = row?.status;
      if (!actionId || (status !== "applied" && status !== "not_applied")) return acc;
      acc[actionId] = status;
      return acc;
    }, {});
    const feedbackMetaByActionId = rows.reduce<
      Record<string, { status: "applied" | "not_applied"; updatedAt: string | null }>
    >((acc, row: any) => {
      const actionId = normalizeActionId(row?.actionId);
      const status = row?.status;
      if (!actionId || (status !== "applied" && status !== "not_applied")) return acc;
      acc[actionId] = {
        status,
        updatedAt: row?.updatedAt instanceof Date ? row.updatedAt.toISOString() : row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      };
      return acc;
    }, {});

    return NextResponse.json({
      objectiveMode,
      timePeriod,
      feedbackByActionId,
      feedbackMetaByActionId,
    });
  } catch (error: any) {
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

    await connectToDatabase();

    const filter = {
      userId: new Types.ObjectId(userId),
      objectiveMode: objectiveModeRaw,
      timePeriod: timePeriodRaw,
      actionId,
    };

    if (status === "clear") {
      await PlanningRecommendationFeedbackModel.deleteOne(filter);
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

    const updated = await PlanningRecommendationFeedbackModel.findOneAndUpdate(
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
