import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";

/**
 * GET /api/plan/status?userId=...
 * Retorna o status do plano e a data de expiração do usuário.
 * Se expirado, atualiza no banco para "expired".
 */
export async function GET(request: NextRequest) {
  try {
    // 1) Conecta ao banco
    await connectToDatabase();

    // 2) Obtém a sessão usando getServerSession, passando um objeto com req e authOptions
    const session = await getServerSession({ req: request, ...authOptions });
    console.debug("[plan/status] Sessão retornada:", session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Lê userId dos query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Faltou userId" }, { status: 400 });
    }

    // 4) Compara userId do param com session.user.id (o ID salvo na sessão)
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 5) Converte para ObjectId e busca o usuário
    const objectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(objectId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // 6) Verifica se o plano expirou
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
