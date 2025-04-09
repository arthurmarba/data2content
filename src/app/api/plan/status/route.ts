// src/app/api/plan/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";

/**
 * GET /api/plan/status?userId=...
 * Retorna o status do plano e a data de expiração do usuário.
 * Se o plano estiver expirado, atualiza no banco para "expired".
 */
export async function GET(request: NextRequest) {
  try {
    // 1) Conecta ao banco de dados
    await connectToDatabase();

    // 2) Extrai o token JWT dos cookies ou headers
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    console.debug("[plan/status] Token extraído:", token);
    if (!token || !token.sub) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Lê userId dos query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Faltou userId" }, { status: 400 });
    }

    // 4) Compara o userId do query param com token.sub
    if (userId !== token.sub) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 5) Converte o userId para ObjectId e busca o usuário no banco de dados
    const objectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(objectId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // 6) Verifica se o plano expirou; se sim, atualiza o status para "expired"
    const now = new Date();
    if (user.planExpiresAt && user.planExpiresAt < now) {
      user.planStatus = "expired";
      await user.save();
    }

    // 7) Retorna planStatus e planExpiresAt
    return NextResponse.json(
      {
        planStatus: user.planStatus,
        planExpiresAt: user.planExpiresAt,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("GET /api/plan/status error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
