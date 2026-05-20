import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  isRealUploadEnabled,
  isTemporaryUploadSessionEnabled,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag";
import { evaluateVideoNarrativeSignedUploadAllowlist } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageAllowlist";
import { validateVideoNarrativeTemporaryUploadCleanupPayload } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadCleanupTypes";
import { deleteVideoNarrativeTemporaryStorageObject } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageRuntimeAdapter";

type MobileStrategicProfileCleanupSession = {
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
    if (!isMobileStrategicProfileEnabled() || !isTemporaryUploadSessionEnabled()) {
      return NextResponse.json(
        { message: "Acesso proibido: cleanup de upload temporário desativado." },
        { status: 403 },
      );
    }

    const session = (await getServerSession(await resolveAuthOptions())) as MobileStrategicProfileCleanupSession;
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

    const serializedBody = JSON.stringify(body);
    if (serializedBody.length > 3000) {
      return NextResponse.json(
        { message: "Regra de segurança: tamanho do payload excedeu o limite máximo seguro." },
        { status: 400 },
      );
    }

    const validation = validateVideoNarrativeTemporaryUploadCleanupPayload(body);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, status: "cleanup_rejected", message: validation.message }, { status: 400 });
    }

    if (isRealUploadEnabled()) {
      const allowlist = evaluateVideoNarrativeSignedUploadAllowlist({ user: session.user });
      if (!allowlist.ok) {
        return NextResponse.json(
          {
            ok: false,
            status: "cleanup_rejected",
            issues: allowlist.issues,
            message: "Cleanup temporário indisponível para este usuário.",
          },
          { status: 403 },
        );
      }
    }

    if (validation.payload.objectKey) {
      const deleted = await deleteVideoNarrativeTemporaryStorageObject({
        objectKey: validation.payload.objectKey,
      });

      if (deleted) {
        return NextResponse.json({
          ok: true,
          status: "cleanup_accepted",
          message: "Arquivo temporário excluído com sucesso do storage.",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      status: "cleanup_not_configured",
      message: "Cleanup temporário registrado em contrato seguro; delete real ainda não configurado.",
    });
  } catch {
    return NextResponse.json(
      { message: "Ocorreu um erro interno ao preparar o cleanup temporário." },
      { status: 500 },
    );
  }
}
