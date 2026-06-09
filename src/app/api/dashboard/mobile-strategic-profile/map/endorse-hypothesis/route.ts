import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorMapConfirmations from "@/app/models/CreatorMapConfirmations";
import { Types } from "mongoose";

/**
 * POST /api/dashboard/mobile-strategic-profile/map/endorse-hypothesis
 *
 * Records the creator's endorsement ("Faz sentido para mim") for a hypothesis.
 * Idempotent — endorsing the same label twice is a no-op.
 *
 * Body: { label: string }
 */
export async function POST(request: Request) {
  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const sessionUser = (session as any)?.user;
  const userId: string | undefined = sessionUser?.id;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  let label: string | undefined;
  try {
    const raw = await request.json().catch(() => ({}));
    if (raw && typeof raw.label === "string" && raw.label.trim().length > 0) {
      label = raw.label.trim();
    }
  } catch {
    // ignore
  }

  if (!label) {
    return NextResponse.json({ message: "Campo 'label' obrigatório." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    await CreatorMapConfirmations.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $addToSet: { endorsedHypotheses: label } },
      { upsert: true, new: true },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[endorse-hypothesis] Erro:", err);
    return NextResponse.json({ message: "Erro ao registrar endorsement." }, { status: 500 });
  }
}
