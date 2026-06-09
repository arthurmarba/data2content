import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import CreatorMapConfirmations from "@/app/models/CreatorMapConfirmations";
import { Types } from "mongoose";

const ALLOWED_FORMATS = ["Reels", "Carrossel", "Story", "Foto", "Vídeo longo"] as const;

/**
 * POST /api/dashboard/mobile-strategic-profile/map/confirm-formats
 *
 * Saves the creator's confirmed preferred formats.
 * Replaces the full list — pass the complete selection, not a delta.
 *
 * Body: { formats: string[] }
 */
export async function POST(request: Request) {
  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const sessionUser = (session as any)?.user;
  const userId: string | undefined = sessionUser?.id;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  let formats: string[] = [];
  try {
    const raw = await request.json().catch(() => ({}));
    if (Array.isArray(raw?.formats)) {
      formats = raw.formats
        .filter((f: unknown) => typeof f === "string" && ALLOWED_FORMATS.includes(f as any))
        .slice(0, 5);
    }
  } catch {
    // ignore
  }

  try {
    await connectToDatabase();
    await CreatorMapConfirmations.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { confirmedFormats: formats } },
      { upsert: true, new: true },
    );
    return NextResponse.json({ ok: true, confirmedFormats: formats });
  } catch (err) {
    console.error("[confirm-formats] Erro:", err);
    return NextResponse.json({ message: "Erro ao salvar formatos." }, { status: 500 });
  }
}
