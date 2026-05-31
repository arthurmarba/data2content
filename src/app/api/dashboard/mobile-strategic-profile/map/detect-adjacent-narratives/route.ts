import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { getMapConfirmationsSnapshot, upsertDetectedAdjacentNarratives } from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";
import { detectAdjacentNarratives } from "@/app/dashboard/boards/videoUpload/adjacentNarrativesDetectionService";
import { buildNarrativeMapMobileViewModelFromReadings } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModelServerSelector";
import {
  hasNarrativeMapInstagramConnection,
  getNarrativeMapAccessLevelForUser,
  hasNarrativeMapPremiumAccess,
  isNarrativeMapAdminUser,
} from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

/**
 * POST /api/dashboard/mobile-strategic-profile/map/detect-adjacent-narratives
 *
 * Detects 2-3 adjacent narrative candidates for the creator using Gemini.
 * Prerequisites: narrative confirmed + territories confirmed + ≥3 readings.
 *
 * - If pending candidates already exist: returns them without re-detecting (idempotent).
 * - If all existing candidates were responded to: runs fresh detection.
 * - Detected candidates are persisted as "pending" in CreatorMapConfirmations.
 *
 * Returns: { ok: true, candidates: [{ label, rationale }] }
 */
export async function POST(request: Request) {
  void request; // no body needed

  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as any;
  const userId: string | undefined = sessionUser?.id;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  // Resolve admin status early — admins bypass prerequisites check
  // (they activate directly in DB without Stripe, so session fields may be incomplete)
  const isAdmin = isNarrativeMapAdminUser(sessionUser);

  // ── Check prerequisites: narrative + territories confirmed ─────────────────
  // Admin bypass: admin users can detect adjacents regardless of confirmation state.
  // For regular users, both dimensions must be confirmed in DB.
  const mapConfirmations = await getMapConfirmationsSnapshot(userId);
  if (!isAdmin && (mapConfirmations?.narrative !== "confirmed" || mapConfirmations?.territories !== "confirmed")) {
    console.log(
      `[detect-adjacent] userId=${userId} prerequisites_not_met narrative=${mapConfirmations?.narrative ?? "null"} territories=${mapConfirmations?.territories ?? "null"}`,
    );
    return NextResponse.json(
      {
        message: "Confirme sua narrativa e territórios antes de descobrir extensões.",
        reason: "prerequisites_not_met",
      },
      { status: 403 },
    );
  }

  // ── Return existing pending candidates (avoid re-detection) ───────────────
  const existingPending = (mapConfirmations.adjacentNarratives ?? []).filter(
    (a) => a.state === "pending",
  );
  if (existingPending.length > 0) {
    return NextResponse.json({
      ok: true,
      candidates: existingPending.map((a) => ({ label: a.label, rationale: null })),
      source: "cached",
    });
  }

  // ── Collect existing labels (all states) to avoid re-proposing ───────────
  const existingAdjacentLabels = (mapConfirmations.adjacentNarratives ?? []).map(
    (a) => a.label,
  );

  // ── Build synthesis from readings ─────────────────────────────────────────
  try {
    await connectToDatabase();
    const accessLevel = getNarrativeMapAccessLevelForUser(sessionUser);
    const isInstagramConnected = hasNarrativeMapInstagramConnection(sessionUser);

    const selectorResult = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: sessionUser?.name ?? "Creator",
      displayHandle: sessionUser?.instagramUsername
        ? `@${sessionUser.instagramUsername}`
        : null,
      accessLevel,
      instagramConnected: isInstagramConnected,
      mediaKitAvailable: false,
    });

    const synthesis = selectorResult.profileSynthesis;

    if (!synthesis.mainNarrative?.label) {
      return NextResponse.json(
        { message: "Mapa ainda sem narrativa principal.", reason: "no_narrative" },
        { status: 422 },
      );
    }

    if (synthesis.analyzedReadingsCount < 3) {
      return NextResponse.json(
        {
          message: "São necessários ao menos 3 vídeos analisados para detectar extensões.",
          reason: "insufficient_readings",
          analyzedReadingsCount: synthesis.analyzedReadingsCount,
        },
        { status: 422 },
      );
    }

    // Build reading signals from synthesis aggregations
    const readingSignals = [
      ...synthesis.testedNarratives.map((s) => ({
        title: null,
        themes: [s.label],
        narrativeContribution: s.summary ?? null,
      })),
      ...synthesis.toneSignals.slice(0, 3).map((s) => ({
        title: null,
        themes: [s.label],
        narrativeContribution: null,
      })),
    ];

    const result = await detectAdjacentNarratives({
      mainNarrative: {
        label: synthesis.mainNarrative.label,
        summary: synthesis.mainNarrative.summary ?? "",
      },
      territories: synthesis.narrativeTerritories.slice(0, 5).map((t) => ({
        label: t.label,
      })),
      tone: synthesis.dominantTone ?? null,
      existingAdjacentLabels,
      analyzedReadingsCount: synthesis.analyzedReadingsCount,
      readingSignals,
    });

    if (!result.ok || !result.candidates || result.candidates.length === 0) {
      console.warn(
        `[detect-adjacent-narratives] Detection failed: ${result.errorCode} — ${result.message}`,
      );
      return NextResponse.json(
        { message: result.message ?? "Não foi possível detectar extensões agora.", reason: result.errorCode },
        { status: 500 },
      );
    }

    // Persist candidates as "pending" in DB
    await upsertDetectedAdjacentNarratives(
      userId,
      result.candidates.map((c) => ({ label: c.label })),
    );

    console.log(
      `[detect-adjacent-narratives] userId=${userId} detected ${result.candidates.length} candidates`,
    );

    return NextResponse.json({
      ok: true,
      candidates: result.candidates,
      source: "fresh",
    });
  } catch (err) {
    console.error("[detect-adjacent-narratives] Error:", err);
    return NextResponse.json({ message: "Erro inesperado." }, { status: 500 });
  }
}
