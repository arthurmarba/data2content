import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { writeLocalVideoNarrativeTemporaryUpload } from "@/app/dashboard/boards/videoUpload/videoNarrativeLocalTemporaryUploadStore";

export const runtime = "nodejs";

const MAX_LOCAL_UPLOAD_BYTES = 300 * 1024 * 1024;

function isEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED === "1";
}

function sign(params: {
  sessionId: string;
  expiresAt: string;
  sizeBytes: number;
  mimeType: string;
}): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || "local-discard-upload-dev-secret";
  return createHmac("sha256", secret)
    .update(`${params.sessionId}.${params.expiresAt}.${params.sizeBytes}.${params.mimeType}`)
    .digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

async function countAndStoreBytes(params: {
  request: Request;
  expectedSizeBytes: number;
  sessionId: string;
  mimeType: string;
}): Promise<boolean> {
  const { request, expectedSizeBytes, sessionId, mimeType } = params;
  const reader = request.body?.getReader();
  if (!reader) return expectedSizeBytes === 0;

  let received = 0;
  const chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > expectedSizeBytes || received > MAX_LOCAL_UPLOAD_BYTES) return false;
    chunks.push(Buffer.from(value));
  }
  if (received !== expectedSizeBytes) return false;
  return writeLocalVideoNarrativeTemporaryUpload({
    sessionId,
    mimeType,
    bytes: Buffer.concat(chunks),
  });
}

export async function PUT(request: Request) {
  if (!isEnabled()) {
    return NextResponse.json({ message: "Upload local de descarte desativado." }, { status: 404 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const expiresAt = url.searchParams.get("expiresAt") ?? "";
  const mimeType = url.searchParams.get("mimeType") ?? "";
  const signature = url.searchParams.get("signature") ?? "";
  const sizeBytes = Number(url.searchParams.get("sizeBytes") ?? "");

  if (
    !/^video-temp-upload-session-local-[a-zA-Z0-9_-]+$/.test(sessionId) ||
    !Number.isFinite(sizeBytes) ||
    sizeBytes < 0 ||
    sizeBytes > MAX_LOCAL_UPLOAD_BYTES ||
    !["video/mp4", "video/quicktime", "video/webm"].includes(mimeType)
  ) {
    return NextResponse.json({ message: "Sessão local inválida." }, { status: 400 });
  }

  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    return NextResponse.json({ message: "Sessão local expirada." }, { status: 410 });
  }

  const expectedSignature = sign({ sessionId, expiresAt, sizeBytes, mimeType });
  if (!safeEqual(signature, expectedSignature)) {
    return NextResponse.json({ message: "Assinatura local inválida." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const normalizedContentType = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  if (normalizedContentType && normalizedContentType !== mimeType) {
    return NextResponse.json({ message: "Tipo do vídeo não corresponde à sessão." }, { status: 400 });
  }

  const ok = await countAndStoreBytes({
    request,
    expectedSizeBytes: sizeBytes,
    sessionId,
    mimeType,
  });
  if (!ok) {
    return NextResponse.json({ message: "Tamanho do vídeo não corresponde à sessão." }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, status: "local_temp_upload_stored" },
    {
      status: 200,
      headers: {
        "x-d2c-local-temp-upload": "stored",
      },
    },
  );
}

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function POST() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}
