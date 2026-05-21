import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  isRealUploadEnabled,
  isTemporaryUploadSessionEnabled,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag";
import { isVideoNarrativeRealAnalysisE2EEnabled } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisFeatureFlag";
import { validateVideoNarrativeRealAnalysisPayload } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisTypes";
import { runVideoNarrativeRealAnalysisOrchestrator } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisOrchestrator";
import { validateVideoNarrativeTemporaryUploadCleanupPayload } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadCleanupTypes";

type MobileStrategicProfileRealAnalysisSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
    isAdmin?: boolean | null;
    isDev?: boolean | null;
    planStatus?: string | null;
    instagramConnected?: boolean | null;
    isInstagramConnected?: boolean | null;
  };
} | null;

function safeResponseCode(code: string | undefined): string | undefined {
  return code?.replace(/gemini/gi, "provider");
}

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

export async function POST(request: Request) {
  try {
    if (
      !isMobileStrategicProfileEnabled() ||
      !isTemporaryUploadSessionEnabled() ||
      !isRealUploadEnabled() ||
      !isVideoNarrativeRealAnalysisE2EEnabled()
    ) {
      return NextResponse.json(
        { message: "Análise real de vídeo indisponível nesta configuração." },
        { status: 403 },
      );
    }

    const session = (await getServerSession(await resolveAuthOptions())) as MobileStrategicProfileRealAnalysisSession;
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Acesso não autorizado: sessão não identificada." },
        { status: 401 },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { message: "Content-type inválido: deve ser application/json." },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Payload inválido: formato JSON corrompido." }, { status: 400 });
    }

    const validation = validateVideoNarrativeRealAnalysisPayload(body);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, message: validation.message, code: validation.code }, { status: 400 });
    }

    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload: validation.payload,
      user: session.user,
      deps: {
        cleanupTemporaryUpload: async ({ uploadSessionId, objectKey, reason }) => {
          const cleanupValidation = validateVideoNarrativeTemporaryUploadCleanupPayload({
            uploadSessionId,
            objectKey,
            reason,
          });
          if (!cleanupValidation.ok) {
            throw new Error("cleanup_payload_rejected");
          }
        },
      },
    });

    if (!result.ok) {
      const status = result.status === "blocked" ? 403 : 502;
      return NextResponse.json(
        {
          ok: false,
          message: result.message,
          code: safeResponseCode(result.safeIssueCode),
          videoReadingPersistence: result.videoReadingPersistence,
          synthesisSnapshotWrite: result.synthesisSnapshotWrite,
          e2eBetaAudit: {
            realAnalysis: false,
            evidenceAnchorsUsed: Boolean(result.evidenceAnchorsUsed),
            cleanupAttempted: Boolean(result.cleanupAttempted),
            usageLimitChecked: Boolean(result.usageLimitChecked),
            allowlistGatePassed: Boolean(result.allowlistGatePassed),
          },
          cleanupWarning: result.cleanupWarning,
        },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      videoReadingPersistence: result.videoReadingPersistence,
      synthesisSnapshotWrite: result.synthesisSnapshotWrite,
      e2eBetaAudit: {
        realAnalysis: result.realAnalysis,
        evidenceAnchorsUsed: result.evidenceAnchorsUsed,
        cleanupAttempted: result.cleanupAttempted,
        usageLimitChecked: result.usageLimitChecked,
        allowlistGatePassed: result.allowlistGatePassed,
      },
      cleanupWarning: result.cleanupWarning,
    });
  } catch {
    return NextResponse.json(
      { message: "Ocorreu um erro ao processar a análise real do diagnóstico." },
      { status: 500 },
    );
  }
}
