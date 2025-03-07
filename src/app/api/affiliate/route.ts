// src/app/api/affiliate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next"; 
// ^ se você estiver usando o NextAuth no App Router
import { authOptions } from "@/app/lib/authOptions"; // ou onde estiver definido
import { connectToDatabase } from "@lib/mongoose";
import User from "@models/user";

export async function GET(request: NextRequest) {
  // 1) Obtém sessão
  const session = await getServerSession(request, authOptions);
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
    affiliate_code: dbUser.affiliateCode,    // ou dbUser.affiliate_code
    affiliate_balance: dbUser.affiliateBalance,
    // inclua outros campos se quiser
  });
}

// Caso queira bloquear outros métodos, podemos retornar 405:
export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
