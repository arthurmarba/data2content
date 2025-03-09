// src/app/api/affiliate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth"; // Import do next-auth
import { authOptions } from "@/app/lib/authOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export async function GET(_request: NextRequest) {
  // 1) Obtém sessão (sem passar o request, pois no App Router
  //    o next-auth consegue ler os cookies do ambiente)
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

// Caso queira bloquear outros métodos, podemos retornar 405:
export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
