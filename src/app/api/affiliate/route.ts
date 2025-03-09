// src/app/api/affiliate/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next"; // ou "next-auth" dependendo da sua configuração
import { authOptions } from "@/app/lib/authOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

/**
 * GET /api/affiliate
 * Retorna dados do afiliado (se user.role === "affiliate").
 * Exemplo: affiliate_code, affiliate_balance, etc.
 */
export async function GET() {
  // 1) Obtém sessão
  const session = await getServerSession(authOptions);

  // 2) Se não houver sessão ou session.user, retorna erro de autenticação
  if (!session || !session.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // 3) Verifica se user.role === "affiliate"
  if (session.user.role !== "affiliate") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // 4) Conecta ao banco e busca dados do user
  await connectToDatabase();
  const dbUser = await User.findById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // 5) Retorna affiliate_code, affiliate_balance etc.
  return NextResponse.json({
    affiliate_code: dbUser.affiliateCode,
    affiliate_balance: dbUser.affiliateBalance,
    // inclua outros campos se quiser
  });
}

/**
 * POST /api/affiliate
 * Bloqueado (retorna 405 Method Not Allowed).
 */
export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
