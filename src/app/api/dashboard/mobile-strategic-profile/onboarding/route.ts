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
 * Saves the creator's declared North and marks the one-screen onboarding as
 * complete. A creator may explicitly skip; in that case the app opens with an
 * empty map and keeps "Meu Norte" available in Profile.
 *
 * Body:
 *   { creatorPurpose: string } | { skip: true }
 */
export async function POST(request: Request) {
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

  const parsed = parseMobileOnboardingBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const { default: UserModel } = await import("@/app/models/User");

    await UserModel.findByIdAndUpdate(userId, {
      $set: {
        onboardingAnswers: {
          whyYouCreate: null,
          desiredFeeling: null,
          contentLimit: null,
          creatorPurpose: parsed.creatorPurpose ?? null,
        },
        onboardingCompletedAt: new Date(),
        isNewUserForOnboarding: false,
      },
    });

    // Fase 3 — preview enriquecido do mapa + Fase 2A — semeia o MapaSeed a partir
    // da hipótese de narrativa, para que ele EXISTA e possa ser enriquecido depois
    // (Instagram/vídeo). Mesma lógica reutilizada por "Meu Norte"/propósito inline.
    // Best-effort: a persistência acima já sucedeu — uma falha aqui NÃO bloqueia o
    // onboarding. Só cria se ainda não houver mapa (não sobrescreve um enriquecido).
    const seedSignal = parsed.skipped
      ? null
      : await import("@/app/lib/mapaSeed/seedMapaSeedFromPurpose")
          .then(({ seedMapaSeedFromPurpose }) => seedMapaSeedFromPurpose(userId, parsed.creatorPurpose));

    return NextResponse.json({ ok: true, skipped: parsed.skipped, seedSignal });
  } catch (err) {
    console.error("[onboarding] Erro ao salvar respostas:", err);
    return NextResponse.json({ message: "Não foi possível salvar as respostas." }, { status: 500 });
  }
}

// ─── Input validation ─────────────────────────────────────────────────────────

type ParseResult =
  | { ok: true; skipped: true; creatorPurpose?: undefined }
  | { ok: true; skipped: false; creatorPurpose: string }
  | { ok: false; error: string };

export function parseMobileOnboardingBody(body: unknown): ParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const b = body as Record<string, unknown>;

  if (b.skip === true) return { ok: true, skipped: true };

  if (typeof b.creatorPurpose !== "string") {
    return { ok: false, error: "creatorPurpose é obrigatório, a menos que o onboarding seja pulado." };
  }

  const creatorPurpose = b.creatorPurpose.trim().slice(0, 400);
  if (creatorPurpose.length < 15) {
    return { ok: false, error: "creatorPurpose deve ter pelo menos 15 caracteres." };
  }

  return { ok: true, skipped: false, creatorPurpose };
}
