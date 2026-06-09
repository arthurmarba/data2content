// src/app/api/onboarding/pautas/[id]/route.ts
// PATCH /api/onboarding/pautas/[id]
//
// Atualiza o status de uma pauta (saved | dismissed | posted).
// Criador usa para: salvar para desenvolver, descartar, ou marcar como publicada.
//
// Body: { status: "saved" | "dismissed" | "posted", scheduledFor?: string }

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import CreatorContentIdea from "@/app/models/CreatorContentIdea";
import type { CreatorContentIdeaStatus } from "@/app/models/CreatorContentIdea";

const STATUS_VALIDOS: CreatorContentIdeaStatus[] = ["saved", "dismissed", "posted", "active"];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const TAG = "[API PATCH /onboarding/pautas/[id]]";

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const { id } = params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "ID inválido." }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ message: "Body inválido." }, { status: 400 });
  }

  const status = body.status as CreatorContentIdeaStatus;
  if (!STATUS_VALIDOS.includes(status)) {
    return NextResponse.json(
      { message: `Status inválido. Use: ${STATUS_VALIDOS.join(", ")}.` },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const updatePayload: Record<string, unknown> = { status };

    if (status === "posted") {
      updatePayload.postedAt = new Date();
    }

    if (typeof body.scheduledFor === "string") {
      const date = new Date(body.scheduledFor);
      if (!isNaN(date.getTime())) {
        updatePayload.scheduledFor = date;
      }
    }

    const updated = await CreatorContentIdea.findOneAndUpdate(
      { _id: id, userId },
      { $set: updatePayload },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ message: "Pauta não encontrada." }, { status: 404 });
    }

    logger.info(`${TAG} Pauta ${id} → status=${status} | userId=${userId}`);

    return NextResponse.json(
      { id: updated._id, status: updated.status, scheduledFor: updated.scheduledFor },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`${TAG} Erro ao atualizar pauta ${id}:`, error);
    return NextResponse.json(
      { message: "Não foi possível atualizar a pauta." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}
