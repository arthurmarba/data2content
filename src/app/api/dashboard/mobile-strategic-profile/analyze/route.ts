import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { runVideoNarrativeMockProvider } from "@/app/dashboard/boards/videoUpload/videoNarrativeMockProvider";
import { upsertStrategicProfileSnapshot } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileSnapshotService";
import { mapAnalysisToSnapshotPayload } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileAnalyzeSnapshotMapper";
import { buildPostCreationVideoSeedFromAnalysis } from "@/app/dashboard/boards/videoUpload/videoNarrativePostCreationSeed";
import { buildVideoNarrativeStrategicDiagnosis, type VideoNarrativeDiagnosisAccessLevel } from "@/app/dashboard/boards/videoUpload/videoNarrativeDiagnosisLearningModel";
import { buildVideoNarrativeDiagnosisQuiz } from "@/app/dashboard/boards/videoUpload/videoNarrativeDiagnosisQuizBuilder";
import {
  getNarrativeMapAccessLevelForUser,
  hasNarrativeMapInstagramConnection,
  hasNarrativeMapPremiumAccess,
  isNarrativeMapAdminUser,
} from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import { assertCanStartNarrativeMapReading } from "@/app/dashboard/boards/videoUpload/narrativeMapReadingQuotaService";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import type {
  VideoNarrativeReadingPersistenceSummary,
  VideoNarrativeSynthesisSnapshotWriteSummary,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeSafeResponseBuilder";

const SIGNED_URL_KEYWORDS = ["signature=", "expires=", "token=", "policy="];
const BASE64_INDICATOR = "base64";
type MobileStrategicProfileSession = {
  user?: {
    id?: string;
    email?: string | null;
    role?: string | null;
    isAdmin?: boolean | null;
    isDev?: boolean | null;
    planStatus?: string | null;
    instagramConnected?: boolean | null;
    isInstagramConnected?: boolean | null;
  };
} | null;
type MobileStrategicProfileUser = NonNullable<NonNullable<MobileStrategicProfileSession>["user"]>;

/** Derives the diagnosis access level from session.
 *  - "instagram_optimized" when Pro + Instagram connected (unlocks IG comparison sections)
 *  - "premium" when Pro only
 *  - "free" otherwise
 */
function deriveAccessLevel(user: NonNullable<NonNullable<MobileStrategicProfileSession>["user"]>): VideoNarrativeDiagnosisAccessLevel {
  return getNarrativeMapAccessLevelForUser(user);
}

async function resolveNarrativeMapAnalysisAccess(sessionUser: MobileStrategicProfileUser) {
  const isAdmin = isNarrativeMapAdminUser(sessionUser);
  let hasPremiumAccess = hasNarrativeMapPremiumAccess(sessionUser);

  if (!hasPremiumAccess && sessionUser?.id) {
    const planAccess = await ensurePlannerAccess({
      session: { user: sessionUser } as any,
      userId: sessionUser.id,
      email: sessionUser.email ?? undefined,
      allowAdmin: true,
      forceReload: true,
      routePath: "/api/dashboard/mobile-strategic-profile/analyze",
    });
    hasPremiumAccess = Boolean(planAccess.ok && planAccess.normalizedStatus);
  }

  return {
    isAdmin,
    hasPremiumAccess: isAdmin || hasPremiumAccess,
    hasFullReportAccess: isAdmin || hasPremiumAccess,
    instagram: {
      connected: hasNarrativeMapInstagramConnection(sessionUser),
      needsReconnect: false,
    },
  };
}

function shouldPersistReading(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && (body as { persistReading?: unknown }).persistReading === true);
}

function shouldPersistSynthesisSnapshot(body: unknown): boolean {
  return Boolean(
    body &&
      typeof body === "object" &&
      (body as { persistSynthesisSnapshot?: unknown }).persistSynthesisSnapshot === true
  );
}

async function persistMockReading(params: {
  body: unknown;
  userId: string;
  diagnosisId: string;
  creatorGoal: string;
  selectedGoalOption: string;
  analysis: ReturnType<typeof runVideoNarrativeMockProvider>;
  seed: ReturnType<typeof buildPostCreationVideoSeedFromAnalysis>;
  createdAt: string;
}): Promise<VideoNarrativeReadingPersistenceSummary> {
  if (!shouldPersistReading(params.body)) {
    return {
      attempted: false,
      saved: false,
      skippedReason: "persist_reading_disabled",
    };
  }

  try {
    const { saveMockVideoNarrativeReading } = await import(
      "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisMockSaveIntegration"
    );
    const result = await saveMockVideoNarrativeReading({
      userId: params.userId,
      diagnosisId: params.diagnosisId,
      creatorGoal: params.creatorGoal,
      selectedGoalOption: params.selectedGoalOption,
      analysis: params.analysis,
      seed: params.seed,
      createdAt: params.createdAt,
    });

    if (result.ok) {
      return {
        attempted: true,
        saved: true,
        diagnosisId: result.diagnosisId,
      };
    }

    return {
      attempted: true,
      saved: false,
      errorCode: result.errorCode,
    };
  } catch {
    return {
      attempted: true,
      saved: false,
      errorCode: "unknown_video_reading_save_error",
    };
  }
}

async function persistMockSynthesisSnapshot(params: {
  body: unknown;
  userId: string;
  readingPersistence: VideoNarrativeReadingPersistenceSummary;
}): Promise<VideoNarrativeSynthesisSnapshotWriteSummary> {
  if (!shouldPersistSynthesisSnapshot(params.body)) {
    return {
      attempted: false,
      written: false,
      skippedReason: "synthesis_write_disabled",
    };
  }

  if (!params.readingPersistence.saved || !params.readingPersistence.diagnosisId) {
    return {
      attempted: false,
      written: false,
      skippedReason: "saved_reading_not_found",
    };
  }

  try {
    const { runControlledVideoReadingSynthesisSnapshotWrite } = await import(
      "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeMockSynthesisSnapshotWriteOrchestrator"
    );
    return await runControlledVideoReadingSynthesisSnapshotWrite({
      userId: params.userId,
      savedDiagnosisId: params.readingPersistence.diagnosisId,
      enableSnapshotWrite: true,
      source: "mock_internal",
      requestId: `mobile-profile-mock-${Date.now()}`,
    });
  } catch {
    return {
      attempted: true,
      written: false,
      skippedReason: "unknown_synthesis_write_error",
    };
  }
}

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function POST(request: Request) {
  try {
    // 1. Feature Flag Check
    if (!isMobileStrategicProfileEnabled()) {
      return NextResponse.json(
        { message: "Acesso proibido: Perfil Estratégico mobile está desativado." },
        { status: 403 }
      );
    }

    // 2. Auth Session Check
    const session = await getServerSession(await resolveAuthOptions()) as MobileStrategicProfileSession;
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Acesso não autorizado: sessão não identificada." },
        { status: 401 }
      );
    }

    // 3. Provider Mode Check
    const providerMode = process.env.VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE || "mock";
    if (providerMode !== "mock") {
      return NextResponse.json(
        { message: "Apenas modo de simulação (mock) é suportado nesta rota." },
        { status: 400 }
      );
    }

    // 4. Content Type Check
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { message: "Content-type inválido: deve ser application/json." },
        { status: 400 }
      );
    }

    // 5. Payload extraction & parsing
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Payload inválido: formato JSON corrompido." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { message: "Payload inválido: deve ser um objeto." },
        { status: 400 }
      );
    }

    // 6. Rígidas regras de segurança contra vazamento de vídeo, URLs e base64
    const forbiddenKeys = ["file", "videoUrl", "thumbnailUrl", "base64", "url", "video"];
    for (const key of forbiddenKeys) {
      if (key in body || body[key]) {
        return NextResponse.json(
          { message: `Regra de segurança: o campo '${key}' não é permitido nesta rota.` },
          { status: 400 }
        );
      }
    }

    const serializedBody = JSON.stringify(body);
    if (serializedBody.length > 5000) {
      return NextResponse.json(
        { message: "Regra de segurança: tamanho do payload excedeu o limite máximo seguro." },
        { status: 400 }
      );
    }

    if (serializedBody.includes(BASE64_INDICATOR) || /data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,/i.test(serializedBody)) {
      return NextResponse.json(
        { message: "Regra de segurança: strings em Base64 não são permitidas." },
        { status: 400 }
      );
    }

    for (const keyword of SIGNED_URL_KEYWORDS) {
      if (serializedBody.toLowerCase().includes(keyword)) {
        return NextResponse.json(
          { message: "Regra de segurança: links assinados ou de mídias não são permitidos." },
          { status: 400 }
        );
      }
    }

    // 7. Validação do formulário leve do creator
    const creatorGoal = typeof body.creatorGoal === "string" ? body.creatorGoal : "";
    const selectedGoalOption = typeof body.selectedGoalOption === "string" ? body.selectedGoalOption : "";

    if (creatorGoal.length > 500 || selectedGoalOption.length > 100) {
      return NextResponse.json(
        { message: "Dados do formulário muito longos." },
        { status: 400 }
      );
    }

    const access = await resolveNarrativeMapAnalysisAccess(session.user);
    const accessDecision = await assertCanStartNarrativeMapReading({
      userId: session.user.id,
      access,
    });
    if (!accessDecision.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: "reading_quota_unavailable",
          accessState: accessDecision.state,
          quota: accessDecision.quota,
          message: accessDecision.message,
        },
        { status: 403 },
      );
    }

    // 8. Resolução do cenário mock baseado no objetivo do criador
    let mockScenario: any = "skincare_routine";
    if (selectedGoalOption === "sponsored_content") {
      mockScenario = "brand_potential";
    } else if (selectedGoalOption === "authority") {
      mockScenario = "backstage_process";
    } else if (selectedGoalOption === "authority_build") {
      mockScenario = "backstage_process"; // mesmo cenário, objetivo distinto: fortalecimento de autoridade
    } else if (selectedGoalOption === "retention") {
      mockScenario = "weak_hook";
    } else if (selectedGoalOption === "format_test") {
      mockScenario = "collab_potential";
    }

    // Se houver um mockScenario explícito enviado para QA (e for um cenário válido), podemos usar opcionalmente
    const allowedScenarios = [
      "skincare_routine",
      "backstage_process",
      "brand_potential",
      "weak_hook",
      "collab_potential",
      "unclear_content",
      "ad_adaptation"
    ];
    if (typeof body.mockScenario === "string" && allowedScenarios.includes(body.mockScenario)) {
      mockScenario = body.mockScenario;
    }

    // 9. Executar a simulação narrativa pura
    const createdAt = new Date().toISOString();
    const analysis = runVideoNarrativeMockProvider({
      input: {
        id: `mock-flow-${Date.now()}`,
        creatorQuestion: creatorGoal || "Como posso melhorar meu posicionamento?",
        createdAt,
      },
      options: {
        scenario: mockScenario,
      },
    });

    // 10. Mapear para Snapshot
    const snapshotPayload = mapAnalysisToSnapshotPayload(analysis);
    const accessLevel = deriveAccessLevel(session.user);
    const isInstagramConnected = Boolean(session.user.instagramConnected || session.user.isInstagramConnected);
    const seed = buildPostCreationVideoSeedFromAnalysis({
      id: `${analysis.id}-seed`,
      analysis,
      creatorQuestion: creatorGoal,
      createdAt: analysis.createdAt ?? createdAt,
    });
    const diagnosis = buildVideoNarrativeStrategicDiagnosis({
      accessLevel,
      analysis,
      seed,
      creatorQuestion: creatorGoal,
      // Pass instagram connection so locked-sections logic works correctly
      instagramContext: { connected: isInstagramConnected },
    });
    const adaptiveQuiz = buildVideoNarrativeDiagnosisQuiz({
      analysis,
      seed,
      diagnosis,
      creatorQuestion: creatorGoal,
      accessLevel,
      existingSignals: diagnosis.creatorSignals,
    });

    // 11. Salvar no banco Mongoose com a fonte mock_analysis
    const upserted = await upsertStrategicProfileSnapshot({
      userId: session.user.id,
      status: "active",
      accessLevel,
      snapshot: snapshotPayload,
      source: "mock_analysis",
      lastAnalyzedAt: new Date(),
    });
    const videoReadingPersistence = await persistMockReading({
      body,
      userId: session.user.id,
      diagnosisId: analysis.id,
      creatorGoal,
      selectedGoalOption,
      analysis,
      seed,
      createdAt: analysis.createdAt ?? createdAt,
    });
    const synthesisSnapshotWrite = await persistMockSynthesisSnapshot({
      body,
      userId: session.user.id,
      readingPersistence: videoReadingPersistence,
    });

    return NextResponse.json({
      ok: true,
      snapshotUpdated: true,
      snapshot: upserted.snapshot,
      videoReadingPersistence,
      synthesisSnapshotWrite,
      adaptiveQuiz,
    });

  } catch (err: any) {
    console.error("Erro no processamento da análise mock:", err);
    return NextResponse.json(
      { message: "Ocorreu um erro ao processar a simulação do seu diagnóstico estratégico." },
      { status: 500 }
    );
  }
}
