import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";

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
 * POST /api/dashboard/mobile-strategic-profile/onboarding
 *
 * Saves creator's onboarding answers and marks onboarding as complete.
 * Answers are stored in User.onboardingAnswers and also converted to
 * pastCreatorAnswers format so the Gemini prompt is calibrated from the
 * first analysis.
 *
 * Body:
 *   { whyYouCreate: string; desiredFeeling: string; contentLimit?: string }
 */
export async function POST(request: Request) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

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

  try {
    await connectToDatabase();
    const { default: UserModel } = await import("@/app/models/User");

    await UserModel.findByIdAndUpdate(userId, {
      $set: {
        onboardingAnswers: {
          whyYouCreate: parsed.whyYouCreate,
          desiredFeeling: parsed.desiredFeeling,
          contentLimit: parsed.contentLimit ?? null,
        },
        onboardingCompletedAt: new Date(),
        isNewUserForOnboarding: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboarding] Erro ao salvar respostas:", err);
    return NextResponse.json({ message: "Não foi possível salvar as respostas." }, { status: 500 });
  }
}

// ─── Input validation ─────────────────────────────────────────────────────────

const WHY_OPTIONS = [
  "expressao_pessoal",
  "construir_audiencia",
  "gerar_renda",
  "construir_autoridade",
  "explorar_criatividade",
] as const;

const FEELING_OPTIONS = [
  "inspirado",
  "informado",
  "entendido",
  "entretido",
  "motivado",
] as const;

type ParseResult =
  | { ok: true; whyYouCreate: string; desiredFeeling: string; contentLimit?: string }
  | { ok: false; error: string };

function parseBody(body: unknown): ParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.whyYouCreate !== "string" || !b.whyYouCreate.trim()) {
    return { ok: false, error: "whyYouCreate é obrigatório." };
  }
  if (!WHY_OPTIONS.includes(b.whyYouCreate as any)) {
    return { ok: false, error: `whyYouCreate inválido. Opções: ${WHY_OPTIONS.join(", ")}.` };
  }

  if (typeof b.desiredFeeling !== "string" || !b.desiredFeeling.trim()) {
    return { ok: false, error: "desiredFeeling é obrigatório." };
  }
  if (!FEELING_OPTIONS.includes(b.desiredFeeling as any)) {
    return { ok: false, error: `desiredFeeling inválido. Opções: ${FEELING_OPTIONS.join(", ")}.` };
  }

  const contentLimit =
    typeof b.contentLimit === "string" && b.contentLimit.trim()
      ? b.contentLimit.trim().slice(0, 300)
      : undefined;

  return {
    ok: true,
    whyYouCreate: b.whyYouCreate,
    desiredFeeling: b.desiredFeeling,
    contentLimit,
  };
}
