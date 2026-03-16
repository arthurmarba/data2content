import { NextRequest, NextResponse } from "next/server";

import { generateCaseDeck } from "@/app/lib/admin/carousels/generateCaseDeck";
import type { CarouselCaseSource } from "@/types/admin/carouselCase";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { source?: CarouselCaseSource } | null;

  if (!body?.source) {
    return NextResponse.json({ error: "Payload inválido: source é obrigatório." }, { status: 400 });
  }

  return NextResponse.json({
    deck: generateCaseDeck(body.source),
  });
}
