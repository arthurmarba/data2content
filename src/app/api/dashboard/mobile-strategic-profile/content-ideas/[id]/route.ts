import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { updateContentIdeaStatus, scheduleContentIdea } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { CreatorContentIdeaStatus } from "@/app/models/CreatorContentIdea";

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function POST() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

const VALID_STATUSES: CreatorContentIdeaStatus[] = ["active", "saved", "dismissed", "posted"];

/**
 * PATCH /api/dashboard/mobile-strategic-profile/content-ideas/[id]
 *
 * Updates status and/or scheduledFor of a single content idea.
 * Body: { status?: "active"|"saved"|"dismissed"|"posted"; scheduledFor?: string|null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.json();
    body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Body inválido." }, { status: 400 });
  }

  const ideaId = params.id;

  // Handle status update
  if ("status" in body) {
    const status = body.status;
    if (typeof status !== "string" || !VALID_STATUSES.includes(status as CreatorContentIdeaStatus)) {
      return NextResponse.json(
        { message: `status deve ser um de: ${VALID_STATUSES.join(", ")}.` },
        { status: 400 },
      );
    }
    const result = await updateContentIdeaStatus(userId, ideaId, status as CreatorContentIdeaStatus);
    if (!result.ok) {
      return NextResponse.json({ message: "Pauta não encontrada." }, { status: 404 });
    }
  }

  // Handle scheduledFor update
  if ("scheduledFor" in body) {
    const raw = body.scheduledFor;
    let scheduledDate: Date | null = null;
    if (typeof raw === "string" && raw.trim().length > 0) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) scheduledDate = d;
    }
    const result = await scheduleContentIdea(userId, ideaId, scheduledDate);
    if (!result.ok) {
      return NextResponse.json({ message: "Pauta não encontrada." }, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true });
}
