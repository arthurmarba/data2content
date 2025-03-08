import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions";

// import mongoose from "mongoose"; // REMOVIDO se não for utilizado
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

/**
 * POST /api/whatsapp/verify
 * Recebe { phoneNumber, code } no body.
 * Verifica se existe um user com esse verificationCode,
 * checa se o userId corresponde ao da sessão e se o plano está ativo.
 * Se tudo certo, vincula o phoneNumber ao user, invalidando o code.
 */
export async function POST(request: Request) {
  try {
    // 1) Verifica sessão
    const session = await getServerSession(request, authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();

    // 2) Lê e valida parâmetros
    const { phoneNumber, code } = (await request.json()) || {};
    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "Parâmetros 'phoneNumber' e 'code' são obrigatórios." },
        { status: 400 }
      );
    }

    // 3) Busca o usuário com esse code
    const user = await User.findOne({ whatsappVerificationCode: code });
    if (!user) {
      return NextResponse.json(
        { error: "Código inválido ou expirado." },
        { status: 404 }
      );
    }

    // 4) Verifica se esse user é o mesmo da sessão
    if (user._id.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Acesso negado: este código não pertence ao seu usuário." },
        { status: 403 }
      );
    }

    // 5) Verifica se o plano está ativo
    if (user.planStatus !== "active") {
      return NextResponse.json(
        { error: "Seu plano não está ativo." },
        { status: 403 }
      );
    }

    // (Opcional) Verificar se algum outro usuário já usa este phoneNumber:
    // const existingPhoneUser = await User.findOne({ whatsappPhone: phoneNumber });
    // if (existingPhoneUser && existingPhoneUser._id.toString() !== user._id.toString()) {
    //   return NextResponse.json(
    //     { error: "Este número de telefone já está vinculado a outro usuário." },
    //     { status: 409 }
    //   );
    // }

    // 6) Vincula phoneNumber e invalida o code
    user.whatsappPhone = phoneNumber;
    user.whatsappVerificationCode = null;
    await user.save();

    // 7) Retorna sucesso
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
