import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint simples para verificar o status do plano do usuário logado.
 * Usado pela página de sucesso para fazer polling até que o status seja 'active'.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).select("planStatus").lean();

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ planStatus: user.planStatus });
  } catch (err: any) {
    console.error("[billing/status] error:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
