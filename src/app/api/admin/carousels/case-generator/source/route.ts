import { NextRequest, NextResponse } from "next/server";

import { buildAnalysisSource } from "@/app/lib/admin/carousels/buildAnalysisSource";
import { buildBootstrapSource } from "@/app/lib/admin/carousels/buildBootstrapSource";
import type {
  CarouselCaseCreatorRef,
  CarouselCaseObjective,
  CarouselCasePlannerPlanSlot,
  CarouselCasePlannerSnapshot,
  CarouselCasePlanningSnapshot,
  CarouselCasePeriod,
} from "@/types/admin/carouselCase";

const VALID_PERIODS = new Set<CarouselCasePeriod>(["7d", "30d", "90d"]);
const VALID_OBJECTIVES = new Set<CarouselCaseObjective>(["engagement", "reach", "leads"]);
const PERIOD_TO_PLANNING_TIME_PERIOD: Record<CarouselCasePeriod, string> = {
  "7d": "last_7_days",
  "30d": "last_30_days",
  "90d": "last_90_days",
};
const PERIOD_TO_DAYS: Record<CarouselCasePeriod, string> = {
  "7d": "7",
  "30d": "30",
  "90d": "90",
};

async function fetchPlanningSnapshot(args: {
  request: NextRequest;
  creatorId: string;
  period: CarouselCasePeriod;
  objective: CarouselCaseObjective;
}): Promise<CarouselCasePlanningSnapshot | null> {
  const { request, creatorId, period, objective } = args;
  const params = new URLSearchParams({
    timePeriod: PERIOD_TO_PLANNING_TIME_PERIOD[period],
    granularity: "weekly",
    objectiveMode: objective,
    limit: "50",
  });

  const response = await fetch(
    `${new URL(request.url).origin}/api/v1/users/${creatorId}/planning/charts-batch?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    },
  ).catch(() => null);

  if (!response?.ok) return null;
  return (await response.json().catch(() => null)) as CarouselCasePlanningSnapshot | null;
}

async function fetchPlannerSnapshot(args: {
  request: NextRequest;
  creatorId: string;
  period: CarouselCasePeriod;
}): Promise<CarouselCasePlannerSnapshot | null> {
  const { request, creatorId, period } = args;
  const params = new URLSearchParams({
    targetUserId: creatorId,
    includeThemes: "1",
    periodDays: PERIOD_TO_DAYS[period],
    targetSlotsPerWeek: "5",
  });

  const response = await fetch(
    `${new URL(request.url).origin}/api/planner/batch?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    },
  ).catch(() => null);

  if (!response?.ok) return null;
  return (await response.json().catch(() => null)) as CarouselCasePlannerSnapshot | null;
}

async function fetchPlannerPlanSlots(args: {
  request: NextRequest;
  creatorId: string;
}): Promise<CarouselCasePlannerPlanSlot[]> {
  const { request, creatorId } = args;
  const params = new URLSearchParams({
    targetUserId: creatorId,
  });

  const response = await fetch(
    `${new URL(request.url).origin}/api/planner/plan?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    },
  ).catch(() => null);

  if (!response?.ok) return [];
  const payload = (await response.json().catch(() => null)) as { plan?: { slots?: CarouselCasePlannerPlanSlot[] | null } } | null;
  return Array.isArray(payload?.plan?.slots) ? payload!.plan!.slots! : [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const creatorId = searchParams.get("creatorId");
  const creatorName = searchParams.get("creatorName");
  const creatorHandle = searchParams.get("creatorHandle");
  const profilePictureUrl = searchParams.get("profilePictureUrl");
  const periodValue = searchParams.get("period");
  const objectiveValue = searchParams.get("objective");

  if (!creatorId || !creatorName) {
    return NextResponse.json(
      { error: "creatorId e creatorName são obrigatórios." },
      { status: 400 },
    );
  }

  const period = VALID_PERIODS.has(periodValue as CarouselCasePeriod)
    ? (periodValue as CarouselCasePeriod)
    : "30d";
  const objective = VALID_OBJECTIVES.has(objectiveValue as CarouselCaseObjective)
    ? (objectiveValue as CarouselCaseObjective)
    : "engagement";

  const creator: CarouselCaseCreatorRef = {
    id: creatorId,
    name: creatorName,
    handle: creatorHandle,
    profilePictureUrl,
  };
  let analysisSource = null;
  let planningSnapshot: CarouselCasePlanningSnapshot | null = null;
  let plannerSnapshot: CarouselCasePlannerSnapshot | null = null;
  let plannerPlanSlots: CarouselCasePlannerPlanSlot[] = [];

  try {
    [planningSnapshot, plannerSnapshot, plannerPlanSlots] = await Promise.all([
      fetchPlanningSnapshot({
        request,
        creatorId,
        period,
        objective,
      }),
      fetchPlannerSnapshot({
        request,
        creatorId,
        period,
      }),
      fetchPlannerPlanSlots({
        request,
        creatorId,
      }),
    ]);

    analysisSource = await buildAnalysisSource({
      creator,
      period,
      objective,
      planningSnapshot,
      plannerSnapshot,
      plannerPlanSlots,
    });
  } catch {
    analysisSource = null;
  }

  return NextResponse.json({
    source:
      analysisSource ||
      buildBootstrapSource({
        creator,
        period,
        objective,
      }),
  });
}
