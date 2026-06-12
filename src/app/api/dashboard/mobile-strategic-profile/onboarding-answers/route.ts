import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";

/**
 * PATCH /api/dashboard/mobile-strategic-profile/onboarding-answers
 *
 * Updates the creator's onboarding answers.
 * Accepts partial updates — only provided fields are overwritten.
 *
 * Body: { whyYouCreate?: string | null; desiredFeeling?: string | null; contentLimit?: string | null; creatorPurpose?: string | null }
 */
export async function PATCH(request: Request) {
  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const sessionUser = (session as any)?.user;
  const userId: string | undefined = sessionUser?.id;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.json().catch(() => ({}));
    body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Accept the four known fields; coerce empty strings to null.
  // creatorPurpose is limited to 150 chars (mirrors the onboarding validation).
  const patch: Record<string, string | null> = {};
  for (const field of ["whyYouCreate", "desiredFeeling", "contentLimit"] as const) {
    if (field in body) {
      const val = body[field];
      patch[`onboardingAnswers.${field}`] =
        typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
    }
  }
  let creatorPurposeValue: string | null | undefined;
  if ("creatorPurpose" in body) {
    const val = body.creatorPurpose;
    creatorPurposeValue =
      typeof val === "string" && val.trim().length > 0
        ? val.trim().slice(0, 400)
        : null;
    patch["onboardingAnswers.creatorPurpose"] = creatorPurposeValue;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "Nenhum campo para atualizar." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const { default: UserModel } = await import("@/app/models/User");
    await UserModel.findByIdAndUpdate(userId, { $set: patch });

    // Quando o criador declara o propósito aqui (Meu Norte ou propósito inline do
    // card), semeia o MapaSeed igual ao onboarding vivo — para que ele exista e
    // possa ser enriquecido por Instagram/vídeo. Best-effort, não bloqueia o save.
    if (creatorPurposeValue) {
      const { seedMapaSeedFromPurpose } = await import("@/app/lib/mapaSeed/seedMapaSeedFromPurpose");
      await seedMapaSeedFromPurpose(userId, creatorPurposeValue);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboarding-answers:patch] Erro:", err);
    return NextResponse.json({ message: "Erro ao salvar respostas." }, { status: 500 });
  }
}
