// src/app/api/affiliate/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next"; // ou "next-auth" se estiver configurado para o App Router
import { authOptions } from "@/app/lib/authOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

/**
 * GET /api/affiliate
 * Retorna dados do afiliado (se user.role === "affiliate").
 * Exemplo: affiliate_code, affiliate_balance, etc.
 */
export async function GET() {
  // 1) Obtém sessão (sem precisar do request se estiver configurado para ler do contexto)
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // 2) Verifica se user.role === "affiliate"
  if (session.user.role !== "affiliate") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // 3) Conecta ao banco e busca dados do user
  await connectToDatabase();
  const dbUser = await User.findById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // 4) Retorna affiliate_code, affiliate_balance etc.
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
