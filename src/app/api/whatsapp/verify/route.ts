// src/app/api/whatsapp/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import mongoose from "mongoose";
import User, { IUser } from "@/app/models/User";

export const runtime = "nodejs";

/**
 * POST /api/whatsapp/verify
 * Recebe { phoneNumber, code } no body.
 * Verifica se o código corresponde a algum usuário e se o plano está ativo.
 * Se tudo estiver correto, vincula o phoneNumber ao usuário e invalida o código.
 *
 * Nota: Este endpoint foi atualizado para permitir a verificação sem depender de sessão,
 * visto que mensagens do WhatsApp não trazem cookies de sessão.
 */
export async function POST(request: NextRequest) {
  try {
    console.debug("[whatsapp/verify] Iniciando verificação de código (sem sessão).");
    
    // Conecta ao banco de dados
    await connectToDatabase();
    
    // Extrai os dados do corpo da requisição
    const body = await request.json();
    console.debug("[whatsapp/verify] Corpo da requisição:", body);
    const { phoneNumber, code } = body;
    if (!phoneNumber || !code) {
      console.error("[whatsapp/verify] Parâmetros ausentes:", body);
      return NextResponse.json(
        { error: "Parâmetros 'phoneNumber' e 'code' são obrigatórios." },
        { status: 400 }
      );
    }
    
    // Busca o usuário com o código de verificação
    console.debug(`[whatsapp/verify] Procurando usuário com código: ${code}`);
    const user = await User.findOne({ whatsappVerificationCode: code }) as IUser | null;
    if (!user) {
      console.error("[whatsapp/verify] Nenhum usuário encontrado com o código:", code);
      return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 404 });
    }
    
    console.debug("[whatsapp/verify] Usuário encontrado com ID:", user._id.toString());
    
    // Verifica se o plano do usuário está ativo
    if (user.planStatus !== "active") {
      console.error("[whatsapp/verify] Plano inativo para o usuário:", user._id.toString());
      return NextResponse.json({ error: "Seu plano não está ativo." }, { status: 403 });
    }
    
    // Atualiza o telefone do usuário e invalida o código de verificação
    console.debug(`[whatsapp/verify] Atualizando telefone para: ${phoneNumber}`);
    user.whatsappPhone = phoneNumber;
    user.whatsappVerificationCode = null;
    await user.save();
    
    console.debug("[whatsapp/verify] Verificação concluída com sucesso para usuário:", user._id.toString());
    return NextResponse.json({ message: "Vinculação concluída com sucesso!" }, { status: 200 });
  } catch (error: unknown) {
    console.error("Erro em POST /api/whatsapp/verify:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Falha ao verificar código: ${errorMessage}` }, { status: 500 });
  }
}
