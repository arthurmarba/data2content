import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorMapConfirmations from "@/app/models/CreatorMapConfirmations";
import { Types } from "mongoose";

/**
 * POST /api/dashboard/mobile-strategic-profile/map/endorse-hypothesis
 *
 * Records the creator's decision on a hypothesis:
 *   action "endorse" (default) → "Faz sentido"     → endorsedHypotheses
 *   action "dismiss"           → "Não faz sentido"  → dismissedHypotheses
 *
 * Idempotent and mutually exclusive: endorsing pulls the label from the
 * dismissed list and vice-versa, so the creator can change their mind.
 * Persisting the dismissal is what keeps a rejected hypothesis from
 * re-surfacing on every page refresh.
 *
 * Body: { label: string; action?: "endorse" | "dismiss" }
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
  let action: "endorse" | "dismiss" = "endorse";
  try {
    const raw = await request.json().catch(() => ({}));
    if (raw && typeof raw.label === "string" && raw.label.trim().length > 0) {
      label = raw.label.trim();
    }
    if (raw && raw.action === "dismiss") {
      action = "dismiss";
    }
  } catch {
    // ignore
  }

  if (!label) {
    return NextResponse.json({ message: "Campo 'label' obrigatório." }, { status: 400 });
  }

  // Mutually exclusive: a decision moves the label into one list and out of the
  // other, so a creator who changes their mind isn't stuck in both.
  const update =
    action === "dismiss"
      ? { $addToSet: { dismissedHypotheses: label }, $pull: { endorsedHypotheses: label } }
      : { $addToSet: { endorsedHypotheses: label }, $pull: { dismissedHypotheses: label } };

  try {
    await connectToDatabase();
    await CreatorMapConfirmations.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      update,
      { upsert: true, new: true },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[endorse-hypothesis] Erro:", err);
    return NextResponse.json({ message: "Erro ao registrar decisão." }, { status: 500 });
  }
}
