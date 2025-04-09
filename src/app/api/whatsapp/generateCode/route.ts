// src/app/api/whatsapp/generateCode/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { connectToDatabase } from "@/app/lib/mongoose";
import mongoose from "mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";

/**
 * Gera um código de verificação aleatório com 6 caracteres maiúsculos.
 */
function generateVerificationCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * POST /api/whatsapp/generateCode
 * Body: { userId }
 * Verifica se o userId corresponde ao usuário autenticado (via JWT),
 * gera um código de verificação e zera o whatsappPhone para forçar re-verificação.
 *
 * Importante: Certifique-se de que o cliente que chama este endpoint inclua
 * a opção `credentials: "include"` para enviar os cookies de sessão.
 */
export async function POST(request: NextRequest) {
  try {
    console.debug(
      "[whatsapp/generateCode] Request Headers:",
      Object.fromEntries(request.headers.entries())
    );
    console.debug("[whatsapp/generateCode] Cookies:", request.cookies);

    // Tenta extrair o token usando getToken
    let token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    console.debug("[whatsapp/generateCode] Token extraído pelo getToken:", token);

    // Extração manual do cookie para comparação
    const manualToken = request.cookies.get("next-auth.session-token")?.value;
    console.debug("[whatsapp/generateCode] Token extraído manualmente:", manualToken);

    // Se getToken não retornou token, tente decodificá-lo manualmente
    if (!token && manualToken) {
      try {
        const decoded = await jwtVerify(
          manualToken,
          new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
        );
        token = decoded.payload;
        console.debug("[whatsapp/generateCode] Token decodificado manualmente:", token);
      } catch (err) {
        console.error("[whatsapp/generateCode] Erro ao decodificar manualmente o token:", err);
      }
    }

    if (!token || !token.sub) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // Lê o corpo da requisição e extrai o userId
    const body = await request.json();
    console.debug("[whatsapp/generateCode] Body recebido:", body);
    const { userId } = body || {};
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // Confirma que o userId informado corresponde ao ID do token
    if (userId !== token.sub) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário autenticado." },
        { status: 403 }
      );
    }

    // Conecta ao banco de dados
    await connectToDatabase();

    // Valida se o userId é um ObjectId válido
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
    }

    // Busca o usuário no banco de dados
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Verifica se o plano do usuário está ativo
    if (user.planStatus !== "active") {
      return NextResponse.json(
        { error: "Você não possui um plano ativo." },
        { status: 403 }
      );
    }

    // Se o usuário já tiver um número vinculado, retorna uma flag para indicar isso
    if (user.whatsappPhone) {
      return NextResponse.json({ linked: true }, { status: 200 });
    }

    // Gera o código de verificação e zera o whatsappPhone para forçar re-verificação
    const verificationCode = generateVerificationCode();
    console.debug("[whatsapp/generateCode] Código gerado:", verificationCode);
    user.whatsappVerificationCode = verificationCode;
    user.whatsappPhone = null;
    await user.save();

    return NextResponse.json({ code: verificationCode }, { status: 200 });
  } catch (error: unknown) {
    console.error("Erro em POST /api/whatsapp/generateCode:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Falha ao gerar código: ${errorMessage}` }, { status: 500 });
  }
}
