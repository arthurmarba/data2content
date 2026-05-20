import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  isTemporaryUploadSessionEnabled,
  isRealUploadEnabled,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag";
import { validateTemporaryUploadInput } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadValidation";
import { evaluateVideoNarrativeSignedUploadAllowlist } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageAllowlist";
import { createVideoNarrativeTemporaryStorageProvider } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageProviderFactory";
import { createServerSideSignedUploadUrlSigner } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageSignedUrlProvider";

const SIGNED_URL_KEYWORDS = ["signature=", "expires=", "token=", "policy="];
const BASE64_INDICATOR = "base64";
type MobileStrategicProfileSession = {
  user?: {
    id?: string;
    email?: string | null;
    role?: string | null;
    isAdmin?: boolean | null;
    isDev?: boolean | null;
  };
} | null;

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

    const realUploadEnabled = isRealUploadEnabled();

    if (realUploadEnabled) {
      const allowlist = evaluateVideoNarrativeSignedUploadAllowlist({
        user: session.user,
      });
      if (!allowlist.ok) {
        return NextResponse.json(
          {
            ok: false,
            status: "disabled",
            reason: "temporary_storage_disabled",
            providerMode: "disabled",
            storageProvider: "none",
            issues: allowlist.issues,
          },
          { status: 403 },
        );
      }
    }

    const storageFactory = createVideoNarrativeTemporaryStorageProvider({
      realUploadEnabled,
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

    return NextResponse.json(providerResult);

  } catch (err: any) {
    // Retorna mensagem amigável sem revelar stack trace
    return NextResponse.json(
      { message: "Ocorreu um erro interno no servidor ao preparar sua sessão de análise." },
      { status: 500 }
    );
  }
}
