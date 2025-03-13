// src/app/api/affiliate/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next"; // ou "next-auth" se estiver configurado para o App Router
import { authOptions } from "@/app/lib/authOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { Session } from "next-auth";

/**
 * Tipo auxiliar para nosso usuário na sessão (com 'role' e 'id').
 * Ajuste conforme suas necessidades (planStatus, etc. se quiser).
 */
interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  id?: string;
}

/**
 * GET /api/affiliate
 * Retorna dados do afiliado (se user.role === "affiliate").
 * Exemplo: affiliate_code, affiliate_balance, etc.
 */
export async function GET() {
  try {
    // 1) Obtém a sessão e a tipifica como Session
    const session = (await getServerSession(authOptions)) as Session | null;
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Faz type assertion do session.user
    const user = session.user as SessionUser;
    if (user.role !== "affiliate") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 3) Conecta ao banco e busca dados do user (usando user.id)
    await connectToDatabase();
    if (!user.id) {
      return NextResponse.json(
        { error: "ID do usuário não encontrado na sessão." },
        { status: 400 }
      );
    }

    const dbUser = await User.findById(user.id);
    if (!dbUser) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 4) Retorna affiliate_code, affiliate_balance etc.
    return NextResponse.json({
      affiliate_code: dbUser.affiliateCode,
      affiliate_balance: dbUser.affiliateBalance,
      // inclua outros campos se quiser
    });
  } catch (error: unknown) {
    console.error("GET /api/affiliate error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/affiliate
 * Bloqueado (retorna 405 Method Not Allowed).
 */
export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
