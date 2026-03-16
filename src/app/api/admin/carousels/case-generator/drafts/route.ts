import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import CarouselCaseDraftModel from "@/app/models/CarouselCaseDraft";
import type {
  CarouselCaseDeck,
  CarouselCaseDraftSummary,
  CarouselCaseSource,
  CarouselCaseVisualPreset,
} from "@/types/admin/carouselCase";
import { getAdminSession } from "@/lib/getAdminSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICE_TAG = "[api/admin/carousels/case-generator/drafts]";

const createDraftSchema = z.object({
  creatorId: z.string().min(1),
  creatorName: z.string().min(1),
  visualPreset: z.enum(["signature", "spotlight", "editorial"]).default("signature"),
  source: z.custom<CarouselCaseSource>(),
  deck: z.custom<CarouselCaseDeck>(),
});

function apiError(message: string, status: number) {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session?.user || session.user.role !== "admin") {
    return apiError("Acesso não autorizado.", 401);
  }

  try {
    await connectToDatabase();

    const drafts = await CarouselCaseDraftModel.find({})
      .sort({ updatedAt: -1 })
      .limit(12)
      .lean();

    const items: CarouselCaseDraftSummary[] = drafts.map((draft) => ({
      id: String(draft._id),
      creatorId: String(draft.creatorId),
      creatorName: draft.creatorName,
      title: draft.deck?.deckTitle || `Carrossel-case • ${draft.creatorName}`,
      periodLabel: draft.source?.period?.label || "Período não informado",
      objectiveLabel: draft.source?.objective?.label || "Objetivo não informado",
      visualPreset: (draft.visualPreset || "signature") as CarouselCaseVisualPreset,
      createdAt: new Date(draft.createdAt).toISOString(),
      updatedAt: new Date(draft.updatedAt).toISOString(),
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    logger.error(`${SERVICE_TAG}[GET] Unexpected error`, error);
    return apiError(error.message || "Erro interno ao listar drafts.", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session?.user || session.user.role !== "admin") {
    return apiError("Acesso não autorizado.", 401);
  }

  try {
    const payload = await req.json();
    const parsed = createDraftSchema.safeParse(payload);
    if (!parsed.success) {
      return apiError("Payload inválido para salvar draft.", 400);
    }

    const { creatorId, creatorName, visualPreset, source, deck } = parsed.data;
    if (!Types.ObjectId.isValid(creatorId)) {
      return apiError("creatorId inválido.", 400);
    }

    await connectToDatabase();

    const draft = await CarouselCaseDraftModel.create({
      creatorId: new Types.ObjectId(creatorId),
      creatorName,
      visualPreset,
      source,
      deck,
      createdBy: {
        id: session.user.id || null,
        name: session.user.name || null,
        email: session.user.email || null,
      },
    });

    return NextResponse.json({
      item: {
        id: String(draft._id),
        creatorId,
        creatorName,
        title: draft.deck?.deckTitle || `Carrossel-case • ${creatorName}`,
        periodLabel: source.period.label,
        objectiveLabel: source.objective.label,
        visualPreset,
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
      } satisfies CarouselCaseDraftSummary,
    });
  } catch (error: any) {
    logger.error(`${SERVICE_TAG}[POST] Unexpected error`, error);
    return apiError(error.message || "Erro interno ao salvar draft.", 500);
  }
}
