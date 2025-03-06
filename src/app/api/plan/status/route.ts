import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

/**
 * GET /api/plan/status?userId=...
 * Retorna o status do plano e a data de expiração
 * Se expirado, atualiza no banco para "expired".
 */
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Faltou userId" }, { status: 400 });
    }

    const objectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(objectId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Verifica se expirou
    const now = new Date();
    if (user.planExpiresAt && user.planExpiresAt < now) {
      user.planStatus = "expired";
      await user.save();
    }

    return NextResponse.json({
      planStatus: user.planStatus,
      planExpiresAt: user.planExpiresAt,
    }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/plan/status error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
