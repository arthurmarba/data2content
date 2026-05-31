import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { getMapConfirmationsSnapshot } from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";
import { evaluateContentIdeasReadiness } from "@/app/dashboard/boards/videoUpload/contentIdeasReadinessGate";
import { generateContentIdeas } from "@/app/dashboard/boards/videoUpload/contentIdeasGenerationService";
import { checkContentIdeasQuota } from "@/app/dashboard/boards/videoUpload/contentIdeasGenerationQuota";
import { listRecentDismissedTitles } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import { buildNarrativeMapMobileViewModelFromReadings } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModelServerSelector";
import {
  hasNarrativeMapInstagramConnection,
  hasNarrativeMapPremiumAccess,
  isNarrativeMapAdminUser,
  getNarrativeMapAccessLevelForUser,
} from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import type { ContentIdeasMapContext } from "@/app/dashboard/boards/videoUpload/contentIdeasGeminiPromptBuilder";
import { buildAudienceInsights, isPlaceholderTerritory } from "@/app/dashboard/boards/videoUpload/audienceInsightsService";
import { buildContentIdeasAudienceResonance } from "@/app/dashboard/boards/videoUpload/contentIdeasAudienceResonance";

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
 * POST /api/dashboard/mobile-strategic-profile/content-ideas/generate
 *
 * Generates pautas (content ideas) from the creator's confirmed map.
 * Requires narrative + territories confirmed and premium access.
 *
 * Body:
 *   { count?: number; focusedTerritory?: string; focusedFormat?: string }
 */
export async function POST(request: Request) {
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

  // ── Body parsing ────────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    const raw = await request.json().catch(() => ({}));
    body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const count = typeof body.count === "number" && body.count >= 1 && body.count <= 6
    ? Math.floor(body.count)
    : 3;
  const focusedTerritory = typeof body.focusedTerritory === "string" ? body.focusedTerritory.trim() : null;
  const focusedFormat = typeof body.focusedFormat === "string" ? body.focusedFormat.trim() : null;

  // ── Access gate: premium or admin only ────────────────────────────────────
  // Read access fields fresh from DB so direct DB activations and stale JWTs
  // don't block legitimate users (mirrors what the page's DIAGNOSTICO_V2_ENABLED
  // path does when building DiagnosticoPageData).
  let effectiveUser = sessionUser;
  try {
    await connectToDatabase();
    const { default: UserModelForAccess } = await import("@/app/models/User");
    const freshUser = await UserModelForAccess.findById(userId)
      .select("planStatus role cancelAtPeriodEnd isAdmin isDev")
      .lean();
    if (freshUser) {
      effectiveUser = {
        ...sessionUser,
        planStatus: (freshUser as any).planStatus ?? sessionUser?.planStatus,
        role: (freshUser as any).role ?? sessionUser?.role,
        cancelAtPeriodEnd: (freshUser as any).cancelAtPeriodEnd ?? sessionUser?.cancelAtPeriodEnd,
        isAdmin: (freshUser as any).isAdmin ?? sessionUser?.isAdmin,
        isDev: (freshUser as any).isDev ?? sessionUser?.isDev,
      };
    }
  } catch {
    // Non-fatal — fall back to JWT session data
  }
  const isAdmin = isNarrativeMapAdminUser(effectiveUser);
  const hasPremium = hasNarrativeMapPremiumAccess(effectiveUser);
  console.log(`[content-ideas:generate] userId=${userId} isAdmin=${isAdmin} hasPremium=${hasPremium} planStatus=${effectiveUser?.planStatus}`);
  if (!isAdmin && !hasPremium) {
    return NextResponse.json(
      { message: "Pautas estão disponíveis para criadores Pro.", reason: "premium_required" },
      { status: 403 },
    );
  }

  // ── Monthly quota gate ─────────────────────────────────────────────────────
  // Bypass APENAS em desenvolvimento local: permite regenerar à vontade no
  // `npm run dev` sem mexer no banco. Em produção, a cota vale normalmente.
  const isDevQuotaBypass = process.env.NODE_ENV === "development";
  if (isDevQuotaBypass) {
    console.log("[content-ideas:generate] DEV — quota gate ignorado (NODE_ENV=development)");
  }
  const quota = isDevQuotaBypass
    ? null
    : await checkContentIdeasQuota({ userId, isAdmin, isPro: hasPremium }).catch(() => null);
  if (quota && !quota.allowed) {
    return NextResponse.json(
      {
        message: `Você usou todas as suas ${quota.limitBatches} gerações de pautas deste mês. Novas pautas disponíveis a partir de ${new Date(quota.resetAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.`,
        reason: "quota_exceeded",
        resetAt: quota.resetAt,
        usedBatches: quota.usedBatches,
        limitBatches: quota.limitBatches,
      },
      { status: 429 },
    );
  }

  // ── Build synthesis first — needed for both the gate and the prompt context ──
  // V2: synthesis data acts as a fallback for explicit map confirmations, so we
  // build it before the readiness gate to avoid blocking creators who filled their
  // map via onboarding (MapaSeed) but never went through the confirmation UX flow.
  try {
    await connectToDatabase();
    const accessLevel = getNarrativeMapAccessLevelForUser(sessionUser);
    const isInstagramConnected = hasNarrativeMapInstagramConnection(sessionUser);

    const selectorResult = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: sessionUser?.name ?? "Creator",
      displayHandle: sessionUser?.instagramUsername ? `@${sessionUser.instagramUsername}` : null,
      accessLevel,
      instagramConnected: isInstagramConnected,
      mediaKitAvailable: false,
    });
    const synthesis = selectorResult.profileSynthesis;

    // ── Map readiness gate (V2) ──────────────────────────────────────────────
    // Accepts synthesis data as fallback for explicit confirmations.
    const mapConfirmations = await getMapConfirmationsSnapshot(userId);
    const synthesisHasNarrative = !!(synthesis.mainNarrative?.label);
    const synthesisHasTerritories = (synthesis.narrativeTerritories?.length ?? 0) > 0;
    const readiness = evaluateContentIdeasReadiness(mapConfirmations, synthesisHasNarrative, synthesisHasTerritories);
    if (!readiness.ready) {
      return NextResponse.json(
        {
          message: readiness.nextStep,
          reason: "map_not_ready",
          missingDimensions: readiness.missingDimensions,
        },
        { status: 403 },
      );
    }

    // Resolve the best available narrative label for prompt context.
    // Priority: (1) confirmed pattern from synthesis, (2) strongest tested narrative,
    // (3) most recent reading's mainNarrative. Falls back to null only when truly empty.
    // This allows pautas to be generated for creators whose map confirmations are set
    // but whose readings haven't accumulated enough evidence for a "confirms_existing_pattern"
    // synthesis yet (e.g. all readings typed as "opens_new_hypothesis").
    const narrativeLabel =
      synthesis.mainNarrative?.label ??
      synthesis.testedNarratives?.[0]?.label ??
      null;
    const narrativeSummary =
      synthesis.mainNarrative?.summary ??
      synthesis.testedNarratives?.[0]?.summary ??
      "";

    if (!narrativeLabel) {
      console.warn(`[content-ideas:generate] no narrative signal for userId=${userId} — all fallbacks exhausted`);
      return NextResponse.json(
        { message: "Mapa ainda sem narrativa detectada. Analise um vídeo para começar.", reason: "no_narrative" },
        { status: 422 },
      );
    }
    console.log(`[content-ideas:generate] narrativeLabel="${narrativeLabel}" source=${synthesis.mainNarrative?.label ? "mainNarrative" : "testedNarrative"}`);

    // Load creator's onboarding answers (intent calibration)
    const { default: UserModel } = await import("@/app/models/User");
    const userDoc = await UserModel.findById(userId).select("onboardingAnswers").lean();
    const onboardingAnswers = ((userDoc as any)?.onboardingAnswers ?? null) as
      | { whyYouCreate?: string | null; desiredFeeling?: string | null; contentLimit?: string | null }
      | null;

    const recentDismissedTitles = await listRecentDismissedTitles(userId, 10);

    const context: ContentIdeasMapContext = {
      narrative: {
        label: narrativeLabel,
        summary: narrativeSummary,
      },
      // Filtra rótulos-placeholder ("Território de marca possível", "em formação"):
      // eles não devem virar chip na tela do criador. Só caímos para os placeholders
      // se NÃO houver nenhum território real (evita zerar a geração).
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
          }
        : null,
      recentDismissedTitles,
      confirmedFormats: mapConfirmations?.confirmedFormats ?? [],
      confirmedAdjacentNarratives: (mapConfirmations?.adjacentNarratives ?? [])
        .filter((a) => a.state === "confirmed")
        .map((a) => a.label),
    };

    if (context.territories.length === 0) {
      return NextResponse.json(
        { message: "Mapa ainda sem territórios detectados. Analise mais um vídeo para o mapa identificar seus assuntos.", reason: "no_territories" },
        { status: 422 },
      );
    }

    // ── Audiência × Criação (Etapa 9): injeta sinais de reconhecimento ─────────
    // Best-effort: sem Instagram/sem sinal confiável, o bloco é omitido e a
    // geração se comporta exatamente como antes (só a partir do mapa).
    try {
      const confirmedTerritoryLabels = context.territories.map((t) => t.label);
      const audienceInsights = await buildAudienceInsights(userId, { confirmedTerritoryLabels });
      const resonance = buildContentIdeasAudienceResonance(audienceInsights, confirmedTerritoryLabels);
      if (resonance) {
        context.audienceResonance = resonance;
        console.log(`[content-ideas:generate] audienceResonance injected:`, JSON.stringify(resonance));
      }
    } catch (err) {
      console.warn("[content-ideas:generate] audience resonance skipped (non-fatal):", err);
    }

    console.log(`[content-ideas:generate] territories=[${context.territories.map(t => t.label).join(", ")}] count=${count}`);
    const result = await generateContentIdeas({
      userId,
      context,
      count,
      focusedTerritory,
      focusedFormat,
    });

    if (!result.ok) {
      console.warn(`[content-ideas:generate] FAILED errorCode=${result.errorCode} — ${result.message}`);
      return NextResponse.json(
        { message: result.message ?? "Não foi possível gerar pautas.", reason: result.errorCode },
        { status: 500 },
      );
    }
    // Telemetria do "match" mapa × audiência: quantos roteiros vieram com a
    // metade-audiência preenchida. Permite medir se a feature está, de fato,
    // produzindo interseções na prática (e não só injetando o sinal).
    const withResonance = (result.ideas ?? []).filter((i) => i.resonanceNote).length;
    console.log(
      `[content-ideas:generate] OK — ${result.ideas?.length ?? 0} ideas generated | ` +
      `audienceInjected=${context.audienceResonance != null} matchRate=${withResonance}/${result.ideas?.length ?? 0}`,
    );

    return NextResponse.json({ ok: true, ideas: result.ideas });
  } catch (err) {
    console.error("[content-ideas:generate] Erro:", err);
    return NextResponse.json({ message: "Erro inesperado." }, { status: 500 });
  }
}
