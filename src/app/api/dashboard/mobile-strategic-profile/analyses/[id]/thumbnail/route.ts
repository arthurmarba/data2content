import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import CreatorVideoNarrativeDiagnosis from "@/app/models/CreatorVideoNarrativeDiagnosis";
import { connectToDatabase } from "@/app/lib/mongoose";
import {
  CONTENT_ANALYSIS_THUMBNAIL_MAX_BYTES,
  readContentAnalysisThumbnail,
  storeContentAnalysisThumbnail,
} from "@/app/dashboard/boards/videoUpload/contentAnalysisThumbnailStorage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function readLimitedBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > CONTENT_ANALYSIS_THUMBNAIL_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function authenticatedOwner(id: string) {
  const session = await getServerSession(await resolveAuthOptions());
  const userId = (session as { user?: { id?: string } } | null)?.user?.id;
  if (!userId) return { status: 401 as const, userId: null };
  await connectToDatabase();
  const exists = await CreatorVideoNarrativeDiagnosis.exists({
    userId,
    diagnosisId: id,
    historyVisibility: { $ne: "hidden" },
  });
  return exists ? { status: 200 as const, userId } : { status: 404 as const, userId: null };
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const owner = await authenticatedOwner(id.trim());
  if (owner.status !== 200 || !owner.userId) {
    return NextResponse.json({ error: owner.status === 401 ? "unauthorized" : "not_found" }, { status: owner.status });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "image/jpeg" && contentType !== "image/webp") {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (declaredSize > CONTENT_ANALYSIS_THUMBNAIL_MAX_BYTES) {
    return NextResponse.json({ error: "thumbnail_too_large" }, { status: 413 });
  }

  try {
    const bytes = await readLimitedBody(request);
    if (!bytes) return NextResponse.json({ error: "thumbnail_too_large" }, { status: 413 });
    const stored = await storeContentAnalysisThumbnail({
      userId: owner.userId,
      diagnosisId: id.trim(),
      bytes,
      contentType,
    });
    await CreatorVideoNarrativeDiagnosis.updateOne(
      { userId: owner.userId, diagnosisId: id.trim() },
      { $set: { thumbnailStatus: stored ? "available" : "failed" } },
    );
    return stored
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "thumbnail_not_stored" }, { status: bytes.byteLength > CONTENT_ANALYSIS_THUMBNAIL_MAX_BYTES ? 413 : 503 });
  } catch {
    await CreatorVideoNarrativeDiagnosis.updateOne(
      { userId: owner.userId, diagnosisId: id.trim() },
      { $set: { thumbnailStatus: "failed" } },
    ).catch(() => undefined);
    return NextResponse.json({ error: "thumbnail_not_stored" }, { status: 503 });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const owner = await authenticatedOwner(id.trim());
  if (owner.status !== 200 || !owner.userId) {
    return NextResponse.json({ error: owner.status === 401 ? "unauthorized" : "not_found" }, { status: owner.status });
  }
  const thumbnail = await readContentAnalysisThumbnail({ userId: owner.userId, diagnosisId: id.trim() });
  if (!thumbnail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(thumbnail.bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": thumbnail.contentType,
      "Cache-Control": "private, max-age=300, stale-while-revalidate=86400",
      "Content-Length": String(thumbnail.bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
