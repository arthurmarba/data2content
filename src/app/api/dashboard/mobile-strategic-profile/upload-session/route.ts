import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  isTemporaryUploadSessionEnabled,
  isRealUploadEnabled,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag";
import { validateTemporaryUploadInput } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadValidation";
import { createVideoNarrativeTemporaryStorageProvider } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageProviderFactory";
import { createServerSideSignedUploadUrlSigner } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageSignedUrlProvider";
import { assertCanStartNarrativeMapReading } from "@/app/dashboard/boards/videoUpload/narrativeMapReadingQuotaService";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import {
  hasNarrativeMapInstagramConnection,
  hasNarrativeMapPremiumAccess,
  isNarrativeMapAdminUser,
} from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import { logUsageEvent } from "@/app/lib/dataService/usageEventService";

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

async function resolveNarrativeMapUploadAccess(sessionUser: NonNullable<MobileStrategicProfileSession>["user"]) {
  const isAdmin = isNarrativeMapAdminUser(sessionUser);
  let hasPremiumAccess = hasNarrativeMapPremiumAccess(sessionUser);

  if (!hasPremiumAccess && sessionUser?.id) {
    const planAccess = await ensurePlannerAccess({
      session: { user: sessionUser } as any,
      userId: sessionUser.id,
      email: sessionUser.email ?? undefined,
      allowAdmin: true,
      forceReload: true,
      routePath: "/api/dashboard/mobile-strategic-profile/upload-session",
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

function isLocalDiscardUploadEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED === "1";
}

function resolveRequestOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = request.headers.get("host")?.trim();
  if (host) {
    return `${forwardedProto || new URL(request.url).protocol.replace(":", "")}://${host}`;
  }
  return new URL(request.url).origin;
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
    // 1. Feature Flag Check
    if (!isMobileStrategicProfileEnabled() || !isTemporaryUploadSessionEnabled()) {
      return NextResponse.json(
        { message: "Acesso proibido: API de sessão de upload temporário desativada." },
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

    const access = await resolveNarrativeMapUploadAccess(session.user);
    const accessDecision = await assertCanStartNarrativeMapReading({
      userId: session.user.id,
      access,
    });
    if (!accessDecision.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: "disabled",
          reason: "reading_quota_unavailable",
          accessState: accessDecision.state,
          quota: accessDecision.quota,
          issues: [
            {
              code: "reading_quota_unavailable",
              message: accessDecision.message,
              severity: "blocker",
            },
          ],
        },
        { status: 403 },
      );
    }

    // 3. Content-Type Check
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { message: "Content-type inválido: deve ser application/json." },
        { status: 400 }
      );
    }

    // 4. Extraction & Payload Size check
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

    const serializedBody = JSON.stringify(body);
    if (serializedBody.length > 5000) {
      return NextResponse.json(
        { message: "Regra de segurança: tamanho do payload excedeu o limite máximo seguro." },
        { status: 400 }
      );
    }

    // 5. Bloqueio estrito de mídias reais ou injeções
    const forbiddenKeys = [
      "file", "video", "videoUrl", "thumbnailUrl", "base64",
      "signedUrl", "uploadUrl", "storageKey", "rawTranscript", "rawModelResponse"
    ];

    for (const key of forbiddenKeys) {
      if (key in body || body[key] !== undefined) {
        return NextResponse.json(
          { message: `Regra de segurança: o campo '${key}' não é permitido nesta rota.` },
          { status: 400 }
        );
      }
    }

    // Bloqueio de Base64 e URLs no payload completo
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

    // 6. Validação dos metadados de upload usando MM59
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
    const durationSeconds = typeof body.durationSeconds === "number" ? body.durationSeconds : undefined;
    const userConsentAccepted = typeof body.userConsentAccepted === "boolean" ? body.userConsentAccepted : false;
    const consentTextVersion = typeof body.consentTextVersion === "string" ? body.consentTextVersion : "";
    const source = typeof body.source === "string" ? body.source : "";

    const localIssues: any[] = [];

    if (!consentTextVersion.trim()) {
      localIssues.push({
        code: "consent_version_required",
        message: "A versão do texto de consentimento deve ser informada.",
        severity: "blocker",
      });
    }

    if (source !== "mobile_strategic_profile") {
      localIssues.push({
        code: "invalid_source",
        message: "A fonte de origem deve ser exatamente 'mobile_strategic_profile'.",
        severity: "blocker",
      });
    }

    const validationResult = validateTemporaryUploadInput({
      fileName,
      mimeType,
      sizeBytes,
      durationSeconds,
      userConsentAccepted,
      source,
      createdAt: new Date().toISOString(),
    });

    const allIssues = [...localIssues, ...validationResult.issues];
    const hasBlockers = allIssues.some((i) => i.severity === "blocker");

    if (hasBlockers) {
      return NextResponse.json(
        {
          ok: false,
          status: "disabled",
          reason: "temporary_upload_disabled",
          issues: allIssues,
        },
        { status: 400 }
      );
    }

    const localDiscardUploadEnabled = isLocalDiscardUploadEnabled();
    const realUploadEnabled = isRealUploadEnabled();

    const requestOrigin = resolveRequestOrigin(request);
    const storageEnv = localDiscardUploadEnabled
      ? {
          ...process.env,
          NEXTAUTH_URL: requestOrigin,
        }
      : realUploadEnabled && accessDecision.ok
        ? {
            ...process.env,
            VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "1",
          }
        : process.env;
    const storageFactory = createVideoNarrativeTemporaryStorageProvider({
      env: storageEnv,
      realUploadEnabled: localDiscardUploadEnabled ? false : realUploadEnabled,
      uploadSessionEnabled: true,
      signedUrlSigner: createServerSideSignedUploadUrlSigner(),
    });
    const providerResult = await storageFactory.provider.createUploadSession({
      fileName,
      mimeType,
      sizeBytes,
      durationSeconds,
      consentTextVersion,
      userId: session.user.id,
      userEmail: session.user.email,
      source: "mobile_strategic_profile",
    });

    if (!providerResult.ok) {
      const hasBlocker = providerResult.issues.some((issue) => issue.severity === "blocker");
      return NextResponse.json(providerResult, { status: hasBlocker ? 400 : 200 });
    }

    logUsageEvent(session.user.id, "video_upload_started", "video", { platform: "mobile" });

    return NextResponse.json(providerResult);

  } catch (err: any) {
    // Retorna mensagem amigável sem revelar stack trace
    return NextResponse.json(
      { message: "Ocorreu um erro interno no servidor ao preparar sua sessão de análise." },
      { status: 500 }
    );
  }
}
