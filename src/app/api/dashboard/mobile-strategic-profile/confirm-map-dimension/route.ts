import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  confirmMapDimension,
  type ConfirmDimensionParams,
} from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";

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

/**
 * PATCH /api/dashboard/mobile-strategic-profile/confirm-map-dimension
 *
 * Persists the creator's confirmation response for one map dimension.
 * Optimistic update is already applied on the client — this is fire-and-persist.
 *
 * Body:
 *   { dimension: "narrative" | "territories" | "tone", response: "yes" | "almost" | "no" }
 *   { dimension: "asset", response: "yes" | "occasional" | "no", assetLabel: string }
 */
export async function PATCH(request: Request) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

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

  const result = await confirmMapDimension(userId, parsed.params);

  if (!result.ok) {
    return NextResponse.json({ message: "Não foi possível persistir a confirmação." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dimension: parsed.params.dimension, state: result.state });
}

// ─── Input validation ─────────────────────────────────────────────────────────

const VALID_DIMENSIONS = ["narrative", "territories", "tone", "asset"] as const;
const VALID_RESPONSES = ["yes", "almost", "no"] as const;
const VALID_ASSET_RESPONSES = ["yes", "occasional", "no"] as const;

type ParseResult =
  | { ok: true; params: ConfirmDimensionParams }
  | { ok: false; error: string };

function parseBody(body: unknown): ParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const b = body as Record<string, unknown>;

  if (!VALID_DIMENSIONS.includes(b.dimension as any)) {
    return { ok: false, error: `dimension deve ser um de: ${VALID_DIMENSIONS.join(", ")}.` };
  }

  const dimension = b.dimension as (typeof VALID_DIMENSIONS)[number];

  if (dimension === "asset") {
    if (!VALID_ASSET_RESPONSES.includes(b.response as any)) {
      return { ok: false, error: `response para asset deve ser um de: ${VALID_ASSET_RESPONSES.join(", ")}.` };
    }
    if (!b.assetLabel || typeof b.assetLabel !== "string" || b.assetLabel.trim() === "") {
      return { ok: false, error: "assetLabel é obrigatório para dimension=asset." };
    }
    return {
      ok: true,
      params: {
        dimension: "asset",
        response: b.response as "yes" | "occasional" | "no",
        assetLabel: b.assetLabel.trim(),
      },
    };
  }

  if (!VALID_RESPONSES.includes(b.response as any)) {
    return { ok: false, error: `response deve ser um de: ${VALID_RESPONSES.join(", ")}.` };
  }

  return {
    ok: true,
    params: {
      dimension,
      response: b.response as "yes" | "almost" | "no",
    },
  };
}
