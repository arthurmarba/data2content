import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel, { type ICreatorProfileExtended, type PlatformReason, type LearningStyle } from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import * as stateService from "@/app/lib/stateService";
import { SUMMARY_GENERATION_INTERVAL } from "@/app/lib/constants";

const TAG = "[api/creator/profile-extended]";

const BASE_PROFILE: ICreatorProfileExtended = {
  stage: [],
  brandTerritories: [],
  niches: [],
  hasHelp: [],
  dreamBrands: [],
  mainGoal3m: null,
  mainGoalOther: "",
  success12m: "",
  mainPains: [],
  otherPain: "",
  hardestStage: [],
  hasDoneSponsoredPosts: null,
  avgPriceRange: null,
  bundlePriceRange: null,
  pricingMethod: null,
  pricingFear: null,
  pricingFearOther: "",
  mainPlatformReasons: [],
  reasonOther: "",
  dailyExpectation: "",
  nextPlatform: [],
  learningStyles: [],
  notificationPref: [],
  updatedAt: undefined,
};

function sanitizeStringArray(raw: unknown, limit: number) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeProfile(
  payload: Partial<ICreatorProfileExtended> | null | undefined,
  existing: ICreatorProfileExtended | null,
): ICreatorProfileExtended {
  const safePayload = payload ?? {};
  const { mainPlatformReason, learningStyle, stage, hasHelp, hardestStage, nextPlatform, notificationPref, ...restPayload } =
    safePayload as any;
  const base = existing ?? BASE_PROFILE;
  const monetizes =
    payload?.hasDoneSponsoredPosts && payload.hasDoneSponsoredPosts !== "nunca-sem-interesse"
      ? payload.hasDoneSponsoredPosts
      : base.hasDoneSponsoredPosts;
  const mainPains = sanitizeStringArray(payload?.mainPains ?? base.mainPains, 2);
  const hasOutroPain = mainPains.includes("outro");
  const bundlePriceRange = monetizes
    ? (payload?.bundlePriceRange ?? base.bundlePriceRange ?? null)
    : null;
  const mainPlatformReasons = sanitizeStringArray(
    Array.isArray(payload?.mainPlatformReasons)
      ? payload?.mainPlatformReasons
      : mainPlatformReason
        ? [mainPlatformReason]
        : base.mainPlatformReasons,
    2,
  ) as PlatformReason[];
  const learningStyles = sanitizeStringArray(
    Array.isArray(payload?.learningStyles)
      ? payload.learningStyles
      : learningStyle
        ? [learningStyle]
        : base.learningStyles,
    2,
  ) as LearningStyle[];
  const stageArr = sanitizeStringArray(
    Array.isArray(stage) ? stage : stage ? [stage] : base.stage,
    2,
  ) as ICreatorProfileExtended["stage"];
  const hasHelpArr = sanitizeStringArray(
    Array.isArray(hasHelp) ? hasHelp : hasHelp ? [hasHelp] : base.hasHelp,
    3,
  ) as ICreatorProfileExtended["hasHelp"];
  const hardestStageArr = sanitizeStringArray(
    Array.isArray(hardestStage) ? hardestStage : hardestStage ? [hardestStage] : base.hardestStage,
    2,
  ) as ICreatorProfileExtended["hardestStage"];
  const nextPlatformArr = sanitizeStringArray(
    Array.isArray(nextPlatform) ? nextPlatform : nextPlatform ? [nextPlatform] : base.nextPlatform,
    2,
  ) as ICreatorProfileExtended["nextPlatform"];
  const notificationPrefArr = sanitizeStringArray(
    Array.isArray(notificationPref) ? notificationPref : notificationPref ? [notificationPref] : base.notificationPref,
    2,
  ) as ICreatorProfileExtended["notificationPref"];
  const shouldRefreshUpdatedAt = payload && payload !== existing;

  const profile: ICreatorProfileExtended = {
    ...BASE_PROFILE,
    ...base,
    ...(restPayload as Partial<ICreatorProfileExtended>),
    brandTerritories: sanitizeStringArray(payload?.brandTerritories ?? base.brandTerritories, 6),
    niches: sanitizeStringArray(payload?.niches ?? base.niches, 5),
    dreamBrands: sanitizeStringArray(payload?.dreamBrands ?? base.dreamBrands, 3),
    mainPains,
    otherPain: hasOutroPain ? (payload?.otherPain ?? base.otherPain ?? "") : "",
    mainGoalOther:
      payload?.mainGoal3m === "outro" ? payload?.mainGoalOther ?? base.mainGoalOther ?? "" : base.mainGoalOther ?? "",
    reasonOther: mainPlatformReasons.includes("outro") ? payload?.reasonOther ?? base.reasonOther ?? "" : "",
    stage: stageArr,
    hasHelp: hasHelpArr,
    hardestStage: hardestStageArr,
    mainPlatformReasons,
    learningStyles,
    nextPlatform: nextPlatformArr,
    notificationPref: notificationPrefArr,
    avgPriceRange: monetizes ? payload?.avgPriceRange ?? base.avgPriceRange ?? null : null,
    bundlePriceRange,
    pricingMethod: monetizes ? payload?.pricingMethod ?? base.pricingMethod ?? null : null,
    pricingFear: monetizes ? payload?.pricingFear ?? base.pricingFear ?? null : null,
    pricingFearOther:
      monetizes && payload?.pricingFear === "outro"
        ? payload?.pricingFearOther ?? base.pricingFearOther ?? ""
        : "",
    hasDoneSponsoredPosts: payload?.hasDoneSponsoredPosts ?? base.hasDoneSponsoredPosts ?? null,
    dailyExpectation: payload?.dailyExpectation ?? base.dailyExpectation ?? "",
    updatedAt: shouldRefreshUpdatedAt ? new Date() : base.updatedAt,
  };

  return profile;
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const user = await UserModel.findById(session.user.id, { creatorProfileExtended: 1 }).lean();
    const profile = user?.creatorProfileExtended
      ? sanitizeProfile(user.creatorProfileExtended, user.creatorProfileExtended)
      : null;
    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    logger.error(`${TAG} GET failed`, error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<ICreatorProfileExtended>;
  try {
    body = (await req.json()) as Partial<ICreatorProfileExtended>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const user = await UserModel.findById(session.user.id, { creatorProfileExtended: 1 });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const sanitized = sanitizeProfile(body, (user as any).creatorProfileExtended ?? null);
    user.set("creatorProfileExtended", sanitized);
    user.set("creatorContext", {
      id: "survey_v1",
      confidence: 1,
      updatedAt: new Date(),
    });
    await user.save();

    // Atualiza estado de diálogo para refletir novo perfil e forçar resumo/contextualização.
    try {
      await stateService.updateDialogueState(user._id.toString(), {
        lastResponseContext: {
          topic: "survey_profile_update",
          timestamp: Date.now(),
          wasQuestion: false,
        },
        pendingActionContext: null,
        lastAIQuestionType: undefined,
        currentTask: null,
        summaryTurnCounter: SUMMARY_GENERATION_INTERVAL || 6, // força novo resumo no próximo turno
        lastInteraction: Date.now(),
      });
    } catch (err) {
      logger.error(`${TAG} Falha ao atualizar dialogueState após survey:`, err);
    }

    return NextResponse.json({ profile: sanitized }, { status: 200 });
  } catch (error) {
    logger.error(`${TAG} PATCH failed`, error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
