// src/app/api/whatsapp/verify/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/authOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import User, { IUser } from "@/app/models/User";
import { Types } from "mongoose";

// Garante que essa rota use Node.js em vez de Edge
export const runtime = "nodejs";

/**
 * POST /api/whatsapp/verify
 * Recebe { phoneNumber, code } no body.
 * Verifica se existe um user com esse verificationCode,
 * checa se o userId corresponde ao da sessão e se o plano está ativo.
 * Se tudo certo, vincula o phoneNumber ao user, invalidando o code.
 */
export async function POST(request: Request) {
  try {
    // 1) Verifica sessão usando apenas `authOptions` (App Router não usa request)
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Extrai o ID do usuário da sessão
    const userWithId = session.user as {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };

    if (!userWithId.id) {
      return NextResponse.json({ error: "Sessão sem ID de usuário" }, { status: 400 });
    }

    // 3) Conecta ao banco
    await connectToDatabase();

    // 4) Lê e valida parâmetros do body
    const { phoneNumber, code } = await request.json();
    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "Parâmetros 'phoneNumber' e 'code' são obrigatórios." },
        { status: 400 }
      );
    }

    // 5) Busca o usuário com esse code
    const user = (await User.findOne({ whatsappVerificationCode: code })) as IUser | null;
    if (!user) {
      return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 404 });
    }

    // 6) Verifica se esse user é o mesmo da sessão
    if ((user._id as Types.ObjectId).toString() !== userWithId.id) {
      return NextResponse.json(
        { error: "Acesso negado: este código não pertence ao seu usuário." },
        { status: 403 }
      );
    }

    // 7) Verifica se o plano está ativo
    if (user.planStatus !== "active") {
      return NextResponse.json({ error: "Seu plano não está ativo." }, { status: 403 });
    }

    // 8) Vincula phoneNumber e invalida o code
    user.whatsappPhone = phoneNumber;
    user.whatsappVerificationCode = null;
    await user.save();

    // 9) Retorna sucesso
    return NextResponse.json(
      { message: "Vinculação concluída com sucesso!" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Erro em POST /api/whatsapp/verify:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Falha ao verificar código: ${errorMessage}` },
      { status: 500 }
    );
  }
}
