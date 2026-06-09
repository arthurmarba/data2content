/**
 * POST /api/cron/regenerate-content-ideas
 *
 * Triggered weekly (e.g. every Monday 09:00 BRT) by QStash.
 *
 * For each Pro/admin creator whose narrative AND territories are confirmed
 * and whose latest content ideas are older than SIX_DAYS_AGO (or absent),
 * silently regenerates 3 fresh pautas — so the map feels alive on next visit.
 *
 * Processing is synchronous and capped at BATCH_SIZE per invocation to stay
 * within serverless timeout. For larger bases, switch to the fan-out pattern
 * used by refresh-instagram-data.
 *
 * Quota check: respects monthly generation limits — skips users who are
 * already at their limit so cron doesn't exhaust the user's own allowance.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Types } from "mongoose";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { evaluateContentIdeasReadiness } from "@/app/dashboard/boards/videoUpload/contentIdeasReadinessGate";
import { generateContentIdeas } from "@/app/dashboard/boards/videoUpload/contentIdeasGenerationService";
import { checkContentIdeasQuota } from "@/app/dashboard/boards/videoUpload/contentIdeasGenerationQuota";
import { listRecentDismissedTitles } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import { getMapConfirmationsSnapshot } from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";
import { buildNarrativeMapMobileViewModelFromReadings } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModelServerSelector";
import {
  isNarrativeMapAdminUser,
  hasNarrativeMapPremiumAccess,
} from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import type { ContentIdeasMapContext } from "@/app/dashboard/boards/videoUpload/contentIdeasGeminiPromptBuilder";
import { buildAudienceInsights, isPlaceholderTerritory } from "@/app/dashboard/boards/videoUpload/audienceInsightsService";
import { buildContentIdeasAudienceResonance } from "@/app/dashboard/boards/videoUpload/contentIdeasAudienceResonance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
if (currentSigningKey && nextSigningKey) {
  receiver = new Receiver({ currentSigningKey, nextSigningKey });
}

/** Users to process per invocation. Keeps us well within serverless timeout. */
const BATCH_SIZE = 30;

/** Ideas older than this are considered stale and eligible for refresh. */
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

// ─── Per-user regeneration logic ─────────────────────────────────────────────

type RegenerateResult =
  | { ok: true }
  | { ok: false; skipped: string };

async function regenerateIdeasIfStale(userId: string): Promise<RegenerateResult> {
  try {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return { ok: false, skipped: "invalid_user_id" };
    }

    await connectToDatabase();

    // ── 1. Load fresh user fields for access check ─────────────────────────
    const { default: UserModel } = await import("@/app/models/User");
    const userDoc = await UserModel.findById(userId)
      .select("name onboardingAnswers planStatus role cancelAtPeriodEnd isAdmin isDev")
      .lean<{
        name?: string;
        onboardingAnswers?: { whyYouCreate?: string; desiredFeeling?: string; contentLimit?: string; creatorPurpose?: string } | null;
        planStatus?: string;
        role?: string;
        cancelAtPeriodEnd?: boolean;
        isAdmin?: boolean;
        isDev?: boolean;
      }>();

    if (!userDoc) return { ok: false, skipped: "user_not_found" };

    const effectiveUser = { ...userDoc, id: userId };
    const isAdmin = isNarrativeMapAdminUser(effectiveUser);
    const hasPremium = hasNarrativeMapPremiumAccess(effectiveUser);

    // Only process Pro or admin creators
    if (!isAdmin && !hasPremium) {
      return { ok: false, skipped: "not_premium" };
    }

    // ── 2. Check if ideas are stale ───────────────────────────────────────
    const { default: CreatorContentIdea } = await import("@/app/models/CreatorContentIdea");
    const latestIdea = await CreatorContentIdea.findOne(
      { userId: new Types.ObjectId(userId), status: { $in: ["active", "saved"] } },
      { generatedAt: 1 },
      { sort: { generatedAt: -1 } },
    ).lean<{ generatedAt?: Date }>();

    if (latestIdea?.generatedAt) {
      const ageMs = Date.now() - new Date(latestIdea.generatedAt).getTime();
      if (ageMs < SIX_DAYS_MS) {
        return { ok: false, skipped: "ideas_fresh" };
      }
    }

    // ── 3. Check map readiness ─────────────────────────────────────────────
    const mapConfirmations = await getMapConfirmationsSnapshot(userId);
    const readiness = evaluateContentIdeasReadiness(mapConfirmations);
    if (!readiness.ready) {
      return { ok: false, skipped: "map_not_ready" };
    }

    // ── 4. Check monthly quota ─────────────────────────────────────────────
    const quota = await checkContentIdeasQuota({ userId, isAdmin, isPro: hasPremium }).catch(() => null);
    if (quota && !quota.allowed) {
      return { ok: false, skipped: "quota_exceeded" };
    }

    // ── 5. Build context ──────────────────────────────────────────────────
    const selectorResult = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: (userDoc.name as string | undefined) ?? "Creator",
      displayHandle: null,
      accessLevel: "premium",
      instagramConnected: false,
      mediaKitAvailable: false,
    });

    const synthesis = selectorResult.profileSynthesis;

    if (!synthesis.mainNarrative?.label) {
      return { ok: false, skipped: "no_narrative" };
    }

    const onboardingAnswers = (userDoc.onboardingAnswers ?? null) as {
      whyYouCreate?: string | null;
      desiredFeeling?: string | null;
      contentLimit?: string | null;
      creatorPurpose?: string | null;
    } | null;

    const recentDismissedTitles = await listRecentDismissedTitles(userId, 10);

    const context: ContentIdeasMapContext = {
      narrative: {
        label: synthesis.mainNarrative.label,
        summary: synthesis.mainNarrative.summary ?? "",
      },
      territories: (() => {
        const all = synthesis.narrativeTerritories.slice(0, 5);
        const real = all.filter((t) => !isPlaceholderTerritory(t.label));
        return (real.length > 0 ? real : all).map((t) => ({
          label: t.label,
          summary: t.summary ?? null,
        }));
      })(),
      confirmedAssets: synthesis.confirmedLifeAssets
        .filter((a) => a.evidenceCount >= 2)
        .map((a) => a.label),
      tone: synthesis.dominantTone ?? null,
      topPerformingPattern: synthesis.topPerformingPattern ?? null,
      pastCreatorAnswers: [],
      onboardingAnswers: onboardingAnswers
        ? {
            whyYouCreate: onboardingAnswers.whyYouCreate ?? null,
            desiredFeeling: onboardingAnswers.desiredFeeling ?? null,
            contentLimit: onboardingAnswers.contentLimit ?? null,
            creatorPurpose: onboardingAnswers.creatorPurpose ?? null,
          }
        : null,
      recentDismissedTitles,
      confirmedFormats: mapConfirmations?.confirmedFormats ?? [],
    };

    if (context.territories.length === 0) {
      return { ok: false, skipped: "no_territories" };
    }

    // ── 5b. Audiência × Criação: injeta sinais de reconhecimento (best-effort) ──
    try {
      const confirmedTerritoryLabels = context.territories.map((t) => t.label);
      const audienceInsights = await buildAudienceInsights(userId, { confirmedTerritoryLabels });
      const resonance = buildContentIdeasAudienceResonance(audienceInsights, confirmedTerritoryLabels);
      if (resonance) context.audienceResonance = resonance;
    } catch (err) {
      logger.warn(`[Cron RegenerateIdeas] userId=${userId} audience resonance skipped:`, err);
    }

    // ── 6. Generate ───────────────────────────────────────────────────────
    const result = await generateContentIdeas({ userId, context, count: 3 });

    if (!result.ok) {
      logger.warn(`[Cron RegenerateIdeas] userId=${userId} generation failed: ${result.errorCode}`);
      return { ok: false, skipped: `generation_failed:${result.errorCode}` };
    }

    logger.info(`[Cron RegenerateIdeas] userId=${userId} — ${result.ideas?.length ?? 0} new ideas generated`);
    return { ok: true };
  } catch (err) {
    logger.error(`[Cron RegenerateIdeas] userId=${userId} unexpected error:`, err);
    return { ok: false, skipped: "unexpected_error" };
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  // Verify QStash signature (skip in development)
  if (process.env.NODE_ENV !== "development" && receiver) {
    const signature = request.headers.get("upstash-signature") ?? "";
    const body = await request.text();
    const isValid = await receiver.verify({ signature, body }).catch(() => false);
    if (!isValid) {
      logger.warn("[Cron RegenerateIdeas] Assinatura QStash inválida.");
      return NextResponse.json({ message: "Assinatura inválida." }, { status: 401 });
    }
  }

  logger.info("[Cron RegenerateIdeas] Iniciando regeneração de pautas.");

  try {
    await connectToDatabase();

    // Find creators with narrative AND territories confirmed
    const { default: CreatorMapConfirmations } = await import("@/app/models/CreatorMapConfirmations");
    const confirmedUsers = await CreatorMapConfirmations.find(
      {
        "narrative.state": "confirmed",
        "territories.state": "confirmed",
      },
      { userId: 1 },
    )
      .limit(BATCH_SIZE)
      .lean<Array<{ userId: { toString(): string } }>>();

    logger.info(`[Cron RegenerateIdeas] ${confirmedUsers.length} criadores com mapa confirmado encontrados.`);

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of confirmedUsers) {
      const result = await regenerateIdeasIfStale(doc.userId.toString());
      if (result.ok) {
        generated++;
      } else if (
        result.skipped === "ideas_fresh" ||
        result.skipped === "not_premium" ||
        result.skipped === "quota_exceeded" ||
        result.skipped === "map_not_ready"
      ) {
        skipped++;
      } else {
        failed++;
      }
    }

    logger.info(
      `[Cron RegenerateIdeas] Concluído. Gerados: ${generated}, Pulados: ${skipped}, Falhas: ${failed}.`,
    );

    return NextResponse.json({ ok: true, generated, skipped, failed });
  } catch (err) {
    logger.error("[Cron RegenerateIdeas] Erro:", err);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// Allow GET for manual triggering in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
  }
  return POST(request);
}
