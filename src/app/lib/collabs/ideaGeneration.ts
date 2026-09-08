


import { connectToDatabase } from "@/app/lib/mongoose";
import { getMapConfirmationsSnapshot } from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";
import { evaluateContentIdeasReadiness } from "@/app/dashboard/boards/videoUpload/contentIdeasReadinessGate";
import { getMapaSeedReadinessSource } from "@/app/dashboard/boards/videoUpload/mapaSeedReadinessSource";
import { generateContentIdeas } from "@/app/dashboard/boards/videoUpload/contentIdeasGenerationService";

import { listRecentDismissedTitles } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import { buildNarrativeMapMobileViewModelFromReadings } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModelServerSelector";
import {
  hasNarrativeMapInstagramConnection,
  getNarrativeMapAccessLevelForUser,
} from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import type { ContentIdeasMapContext } from "@/app/dashboard/boards/videoUpload/contentIdeasGeminiPromptBuilder";
import { buildAudienceInsights, isPlaceholderTerritory } from "@/app/dashboard/boards/videoUpload/audienceInsightsService";
import { buildContentIdeasAudienceResonance } from "@/app/dashboard/boards/videoUpload/contentIdeasAudienceResonance";
import { buildContentIdeasOpportunityContext } from "@/app/dashboard/boards/videoUpload/contentIdeasOpportunityContext";

import User from '@/app/models/User';
function response(data: Record<string, any>, init: {status?: number} = {}) { return { data, status: init.status || 200 }; }
export async function generateIdeasForUser(userId: string, input: Record<string, any>, generationId: string) {
  await connectToDatabase();
  const user = await User.findById(userId).select('name instagramUsername isInstagramConnected instagramAccountId planStatus currentPeriodEnd cancelAtPeriodEnd role').lean();
  if (!user) return response({reason:'user_missing'}, {status:404});
  const sessionUser = { ...user, id:userId, instagramUsername: (user as any).instagramUsername as string | undefined };
  const effectiveCount = Math.max(1, Math.min(6, Number(input.count)||3));
  const focusedTerritory = typeof input.focusedTerritory === 'string' ? input.focusedTerritory.slice(0,120) : null;
  const focusedFormat = typeof input.focusedFormat === 'string' ? input.focusedFormat.slice(0,60) : null;
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
    // Fase 2C — o MapaSeed (onboarding + enriquecimento de Instagram/vídeo) é fonte
    // de narrativa/territórios ao lado da síntese de vídeo. Destrava pautas a partir
    // do mapa que o criador já tem, sem forçar uma 2ª leitura. Best-effort: sem
    // MapaSeed, cai no comportamento anterior (só síntese de vídeo).
    const mapaSeedSource = await getMapaSeedReadinessSource(userId);
    const synthesisHasNarrative = !!(synthesis.mainNarrative?.label) || mapaSeedSource.hasNarrative;
    const synthesisHasTerritories = (synthesis.narrativeTerritories?.length ?? 0) > 0 || mapaSeedSource.hasTerritories;
    const readiness = evaluateContentIdeasReadiness(mapConfirmations, synthesisHasNarrative, synthesisHasTerritories);
    if (!readiness.ready) {
      return response(
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
      mapaSeedSource.narrativeLabel ??
      synthesis.mainNarrative?.label ??
      synthesis.testedNarratives?.[0]?.label ??
      null;
    const narrativeSummary =
      (mapaSeedSource.narrativeLabel ? "" : synthesis.mainNarrative?.summary) ??
      synthesis.testedNarratives?.[0]?.summary ??
      "";

    if (!narrativeLabel) {
      console.warn(`[content-ideas:generate] no narrative signal for userId=${userId} — all fallbacks exhausted`);
      return response(
        { message: "Seu mapa ainda não tem um tema principal. Analise um vídeo para começar.", reason: "no_narrative" },
        { status: 422 },
      );
    }
    console.log(`[content-ideas:generate] narrativeLabel="${narrativeLabel}" source=${synthesis.mainNarrative?.label ? "mainNarrative" : "testedNarrative"}`);

    // Load creator's onboarding answers (intent calibration)
    const { default: UserModel } = await import("@/app/models/User");
    const userDoc = await UserModel.findById(userId).select("onboardingAnswers").lean();
    const onboardingAnswers = ((userDoc as any)?.onboardingAnswers ?? null) as
      | { whyYouCreate?: string | null; desiredFeeling?: string | null; contentLimit?: string | null; creatorPurpose?: string | null }
      | null;

    // 25 (não 10): descartes antigos que caíam da janela voltavam como
    // quase-duplicatas. 25 cobre bem mais histórico sem inchar o prompt.
    const recentDismissedTitles = await listRecentDismissedTitles(userId, 25);

    const context: ContentIdeasMapContext = {
      narrative: {
        label: narrativeLabel,
        summary: narrativeSummary,
      },
      // Filtra rótulos-placeholder ("Território de marca possível", "em formação"):
      // eles não devem virar chip na tela do criador. Só caímos para os placeholders
      // se NÃO houver nenhum território real (evita zerar a geração).
      territories: (() => {
        if (mapaSeedSource.territories.length) return mapaSeedSource.territories.filter(label => !isPlaceholderTerritory(label)).slice(0, 8).map(label => ({ label, summary: null }));
        const all = synthesis.narrativeTerritories.slice(0, 5);
        const real = all.filter((t) => !isPlaceholderTerritory(t.label));
        const fromSynthesis = real.map((t) => ({
          label: t.label,
          summary: t.summary ?? null,
        }));
        if (fromSynthesis.length > 0) return fromSynthesis;
        // Fase 2C — sem territórios na síntese de vídeo, usa os do MapaSeed
        // (onboarding/Instagram) para alimentar o prompt. Injeta summary
        // ancorando cada território na narrativa central: sem isso, o LLM
        // interpreta rótulos ambíguos (ex: "carreira artística") de forma
        // genérica (músico/ator) em vez de específica (criador digital com IA).
        return mapaSeedSource.territories
          .slice(0, 5)
          .map((label) => ({
            label,
            summary: narrativeLabel
              ? `Ângulo de "${narrativeLabel}" relacionado a: ${label.toLowerCase()}.`
              : null,
          }));
      })(),
      // Assets: prioriza os confirmados pela síntese de vídeo (evidência ≥2).
      // Quando vazios (criador de Instagram/onboarding, sem vídeo), cai para os
      // assets do MapaSeed — a camada mais concreta do mapa, que antes nunca
      // chegava ao gerador para esses criadores.
      confirmedAssets: (() => {
        const fromVideo = synthesis.confirmedLifeAssets
          .filter((a) => a.evidenceCount >= 2)
          .map((a) => a.label);
        return fromVideo.length > 0 ? fromVideo : mapaSeedSource.assets.slice(0, 12);
      })(),
      // Temas confirmados/editados no card (camada-cena) — pontos de partida do roteiro.
      confirmedThemes: mapaSeedSource.temas.slice(0, 8),
      tone: synthesis.dominantTone ?? mapaSeedSource.tone ?? null,
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
      confirmedAdjacentNarratives: (mapConfirmations?.adjacentNarratives ?? [])
        .filter((a) => a.state === "confirmed")
        .map((a) => a.label),
    };

    if (context.territories.length === 0) {
      return response(
        { message: "Seu mapa ainda não tem assuntos suficientes. Analise mais um vídeo para continuar.", reason: "no_territories" },
        { status: 422 },
      );
    }

    if (focusedTerritory && !context.territories.some(territory => territory.label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() === focusedTerritory.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase())) return response({ reason: 'territory_outside_map', message: 'Escolha um território do Seu Mapa.' }, { status: 422 });
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

    // Assuntos, aberturas, lugares, objetos e horários dos vídeos recentes.
    // Best-effort: sem Instagram ou com poucos dados, a ideia continua vindo do Mapa.
    try {
      context.opportunityContext = await buildContentIdeasOpportunityContext(userId);
    } catch (err) {
      console.warn("[content-ideas:generate] opportunity context skipped (non-fatal):", err);
    }

    console.log(`[content-ideas:generate] territories=[${context.territories.map(t => t.label).join(", ")}] count=${effectiveCount}`);
    const result = await generateContentIdeas({
      userId,
      context,
      count: effectiveCount,
      generationId,
      focusedTerritory,
      focusedFormat,
    });

    if (!result.ok) {
      console.warn(`[content-ideas:generate] FAILED errorCode=${result.errorCode} — ${result.message}`);
      return response(
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

    return response({ ok: true, ideas: result.ideas, partial: (result.ideas?.length || 0) < effectiveCount });
  } catch (err) {
    console.error("[content-ideas:generate] Erro:", err);
    return response({ message: "Erro inesperado." }, { status: 500 });
  }
}
