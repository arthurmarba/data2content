import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  confirmAdjacentNarrative,
  addManualAdjacentNarrative,
} from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";
import type { AdjacentNarrativeResponse } from "@/app/models/CreatorMapConfirmations";

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

/**
 * POST /api/dashboard/mobile-strategic-profile/map/confirm-adjacent
 *
 * Records a creator's response to an adjacent narrative candidate,
 * or adds a free-text manual adjacent narrative.
 *
 * Body — confirm detected candidate:
 *   { action: "confirm"; label: string; response: "yes" | "almost" | "no" }
 *
 * Body — add manual (free-text):
 *   { action: "add"; label: string }
 */
export async function POST(request: Request) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const sessionUser = (session as any)?.user;
  const userId: string | undefined = sessionUser?.id;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Body inválido." }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  if (parsed.action === "add") {
    const result = await addManualAdjacentNarrative(userId, parsed.label);
    if (!result.ok) {
      return NextResponse.json(
        { message: "Não foi possível adicionar a extensão." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, action: "add", label: parsed.label });
  }

  // action === "confirm"
  const result = await confirmAdjacentNarrative(userId, parsed.label, parsed.response);
  if (!result.ok) {
    return NextResponse.json(
      { message: "Não foi possível salvar a resposta." },
      { status: 500 },
    );
  }

  const state = parsed.response === "no" ? "dismissed" : "confirmed";
  return NextResponse.json({ ok: true, action: "confirm", label: parsed.label, state });
}

// ─── Input validation ─────────────────────────────────────────────────────────

const VALID_RESPONSES: AdjacentNarrativeResponse[] = ["yes", "almost", "no"];

type ParseResult =
  | { ok: true; action: "confirm"; label: string; response: AdjacentNarrativeResponse }
  | { ok: true; action: "add"; label: string }
  | { ok: false; error: string };

function parseBody(body: unknown): ParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const b = body as Record<string, unknown>;
  const action = b.action;

  if (action !== "confirm" && action !== "add") {
    return { ok: false, error: "action deve ser 'confirm' ou 'add'." };
  }

  if (typeof b.label !== "string" || b.label.trim().length === 0) {
    return { ok: false, error: "label é obrigatório e não pode ser vazio." };
  }

  const label = b.label.trim();

  if (label.length > 120) {
    return { ok: false, error: "label não pode ter mais de 120 caracteres." };
  }

  if (action === "add") {
    return { ok: true, action: "add", label };
  }

  // action === "confirm"
  if (!VALID_RESPONSES.includes(b.response as AdjacentNarrativeResponse)) {
    return {
      ok: false,
      error: `response deve ser um de: ${VALID_RESPONSES.join(", ")}.`,
    };
  }

  return { ok: true, action: "confirm", label, response: b.response as AdjacentNarrativeResponse };
}
