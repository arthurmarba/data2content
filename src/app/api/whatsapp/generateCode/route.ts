// src/app/api/whatsapp/generateCode/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { connectToDatabase } from "@/app/lib/mongoose";
import mongoose from "mongoose";
import User from "@/app/models/User"; // Assuming IUser interface is also imported or handled by User model

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
 */
export async function POST(request: NextRequest) {
  console.log("[whatsapp/generateCode] Request received."); // Log inicial

  try {
    // Log Headers usando console.log para garantir visibilidade
    console.log(
      "[whatsapp/generateCode] Request Headers:",
      Object.fromEntries(request.headers.entries()) // Convert Headers object to plain object for logging
    );

    // Log Cookies usando console.log (CORRIGIDO)
    let cookiesLog: { [key: string]: string } = {};
    const allCookies = request.cookies.getAll(); // Use getAll()
    allCookies.forEach(cookie => {
        cookiesLog[cookie.name] = cookie.value;
    });
    console.log("[whatsapp/generateCode] Cookies:", cookiesLog);


    // Tenta extrair o token usando getToken
    let token: any = null; // Initialize token as null
    try {
        token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
        });
        console.log("[whatsapp/generateCode] Token extraído pelo getToken:", token);
    } catch (getTokenError) {
        console.error("[whatsapp/generateCode] Erro ao tentar usar getToken:", getTokenError);
    }


    // Extração manual do cookie (com nome corrigido para produção)
    const cookieName = process.env.NODE_ENV === 'production'
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token";
    const manualTokenValue = request.cookies.get(cookieName)?.value;
    console.log(`[whatsapp/generateCode] Tentando ler cookie: ${cookieName}`);
    console.log("[whatsapp/generateCode] Valor do token extraído manualmente:", manualTokenValue ? manualTokenValue.substring(0,15) + '...' : 'Nenhum');


    // Se getToken não retornou token, tente decodificá-lo manualmente
    if (!token && manualTokenValue) {
      console.log("[whatsapp/generateCode] getToken falhou ou retornou null, tentando decodificar manualmente...");
      try {
        // Certifique-se que NEXTAUTH_SECRET existe antes de usar
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
            throw new Error("NEXTAUTH_SECRET não está definido no ambiente.");
        }
        const decoded = await jwtVerify(
          manualTokenValue,
          new TextEncoder().encode(secret)
        );
        token = decoded.payload; // Atribui o payload decodificado
        console.log("[whatsapp/generateCode] Token decodificado manualmente com sucesso:", token);
      } catch (err) {
        console.error("[whatsapp/generateCode] Erro ao decodificar manualmente o token:", err);
        // Token não será definido ou permanecerá null se a decodificação falhar
      }
    }

    // Verifica se temos um token válido com 'sub' (ID do usuário)
    if (!token || !token.sub) {
      console.warn("[whatsapp/generateCode] Falha na autenticação: Token inválido ou 'sub' ausente.", { hasToken: !!token, hasSub: !!token?.sub });
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    console.log(`[whatsapp/generateCode] Autenticação bem-sucedida. User ID (token.sub): ${token.sub}`);

    // Lê o corpo da requisição e extrai o userId
    let body: any;
    let userId: string | undefined;
    try {
        body = await request.json();
        userId = body?.userId;
        console.log("[whatsapp/generateCode] Body recebido:", body);
    } catch (parseError) {
        console.error("[whatsapp/generateCode] Erro ao fazer parse do corpo JSON:", parseError);
        return NextResponse.json({ error: "Corpo da requisição inválido ou não é JSON." }, { status: 400 });
    }

    if (!userId) {
      console.warn("[whatsapp/generateCode] Falha na validação: 'userId' ausente no corpo.");
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // ---- LOGS ADICIONADOS/MODIFICADOS PARA A VERIFICAÇÃO DE AUTORIZAÇÃO Nº 1 ----
    console.log(`[whatsapp/generateCode] userId recebido no body: ${userId}`);
    console.log(`[whatsapp/generateCode] ID do usuário no token (token.sub): ${token.sub}`); // Log do token.sub

    // Confirma que o userId informado corresponde ao ID do token (Autorização nº 1)
    if (userId !== token.sub) {
      // Log SIMPLIFICADO e ALTO para garantir visibilidade
      console.error(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
      console.error(`[AUTORIZAÇÃO Nº 1 FALHOU] userId Body: ${userId} !== token.sub: ${token.sub}`);
      console.error(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
      // Mantém o warn original também, por segurança
      console.warn(`[whatsapp/generateCode] Falha na Autorização nº 1: userId do body ('${userId}') não corresponde ao token.sub ('${token.sub}'). Retornando 403.`);
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário autenticado." },
        { status: 403 }
      );
    }
    // Se passar, loga o sucesso
    console.log("[whatsapp/generateCode] Autorização nº 1 (User Match): OK.");
    // --------------------------------------------------------------------------


    // Conecta ao banco de dados
    try {
        await connectToDatabase();
        console.log("[whatsapp/generateCode] Conectado ao banco de dados.");
    } catch (dbError) {
        console.error("[whatsapp/generateCode] Falha ao conectar ao banco de dados:", dbError);
        return NextResponse.json({ error: "Erro interno do servidor (DB Connect)." }, { status: 500 });
    }


    // Valida se o userId é um ObjectId válido
    if (!mongoose.isValidObjectId(userId)) {
       console.warn(`[whatsapp/generateCode] Falha na validação: userId '${userId}' não é um ObjectId válido.`);
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
    }

    // Busca o usuário no banco de dados
    const user = await User.findById(userId);
    if (!user) {
       console.warn(`[whatsapp/generateCode] Usuário com ID '${userId}' não encontrado no banco de dados.`);
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    console.log(`[whatsapp/generateCode] Usuário encontrado no DB: ${user._id}`);


    // Log para verificar o status antes do check
    console.log(`[whatsapp/generateCode] Verificando status do plano para usuário ${user._id}. Status atual no DB: '${user.planStatus}'`);

    // Verifica se o plano do usuário está ativo (Autorização nº 2)
    if (user.planStatus !== "active") {
      // Log para quando a verificação falha
      console.warn(`[whatsapp/generateCode] Falha na Autorização nº 2 (Plano): Status do plano é '${user.planStatus}', esperado 'active'. Retornando 403.`);
      return NextResponse.json(
        { error: "Você não possui um plano ativo ou acesso permitido." },
        { status: 403 }
      );
    }
    console.log("[whatsapp/generateCode] Autorização nº 2 (Plano Ativo): OK.");


    // Se o usuário já tiver um número vinculado, retorna uma flag para indicar isso
    if (user.whatsappPhone) {
      console.log(`[whatsapp/generateCode] Usuário ${user._id} já possui telefone vinculado: ${user.whatsappPhone}. Retornando status 'linked'.`);
       return NextResponse.json({ linked: true, message: "Telefone já vinculado." }, { status: 200 });
    }


    // Gera o código de verificação e zera o whatsappPhone para forçar re-verificação
    const verificationCode = generateVerificationCode();
    console.log(`[whatsapp/generateCode] Gerando novo código de verificação para usuário ${user._id}: ${verificationCode}`);
    user.whatsappVerificationCode = verificationCode;
    user.whatsappPhone = null;
    user.whatsappVerified = false;
    await user.save();
    console.log(`[whatsapp/generateCode] Código salvo e whatsappPhone/whatsappVerified resetados para usuário ${user._id}.`);

    // Retorna apenas o código gerado
    return NextResponse.json({ code: verificationCode }, { status: 200 });

  } catch (error: unknown) {
    // Log detalhado do erro
    console.error("Erro GERAL em POST /api/whatsapp/generateCode:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Mensagem genérica para o cliente
    return NextResponse.json({ error: `Falha ao gerar código.` }, { status: 500 });
  }
}
