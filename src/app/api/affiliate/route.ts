import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import type { Session } from "next-auth";

export const runtime = "nodejs";

/**
 * Tipo auxiliar para o usuário na sessão.
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
export async function GET(request: NextRequest) {
  try {
    // 1) Log do cookie recebido (para debug)
    const rawCookie = request.headers.get("cookie");
    console.debug("[affiliate:GET] Cookie recebido:", rawCookie || "NENHUM COOKIE");

    // 2) Obtém a sessão usando getServerSession
    const session = (await getServerSession({ req: request, ...authOptions })) as Session | null;
    console.debug("[affiliate:GET] Sessão retornada:", session);

    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Faz type assertion do session.user
    const user = session.user as SessionUser;
    if (user.role !== "affiliate") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 4) Conecta ao banco e busca o usuário
    await connectToDatabase();

    if (!user.id) {
      return NextResponse.json({ error: "ID do usuário não encontrado na sessão." }, { status: 400 });
    }

    const dbUser = await User.findById(user.id);
    if (!dbUser) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 5) Retorna os dados do afiliado
    return NextResponse.json({
      affiliate_code: dbUser.affiliateCode,
      affiliate_balances: Object.fromEntries(dbUser.affiliateBalances || []),
    });
  } catch (error: unknown) {
    console.error("[affiliate:GET] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/affiliate
 * Método bloqueado (retorna 405 Method Not Allowed).
 */
export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
