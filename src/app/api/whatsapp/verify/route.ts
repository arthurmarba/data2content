import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User, { IUser } from "@/app/models/User";
import { Types } from "mongoose";

export const runtime = "nodejs";

/**
 * POST /api/whatsapp/verify
 * Recebe { phoneNumber, code } no body.
 * Verifica se existe um usuário com o verificationCode fornecido,
 * confirma se o usuário corresponde à sessão e se o plano está ativo.
 * Se tudo estiver correto, vincula o phoneNumber ao usuário e invalida o código.
 */
export async function POST(request: NextRequest) {
  try {
    // 1) Obtém a sessão do usuário
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    
    // 2) Extrai o ID do usuário da sessão
    const userSession = session.user as { id?: string };
    if (!userSession.id) {
      return NextResponse.json({ error: "Sessão sem ID de usuário" }, { status: 400 });
    }
    
    // 3) Conecta ao banco de dados
    await connectToDatabase();
    
    // 4) Lê e valida os parâmetros do body
    const { phoneNumber, code } = await request.json();
    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "Parâmetros 'phoneNumber' e 'code' são obrigatórios." },
        { status: 400 }
      );
    }
    
    // 5) Busca o usuário com o verificationCode fornecido
    const user = (await User.findOne({ whatsappVerificationCode: code })) as IUser | null;
    if (!user) {
      return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 404 });
    }
    
    // 6) Verifica se o usuário encontrado corresponde ao usuário da sessão
    if ((user._id as Types.ObjectId).toString() !== userSession.id) {
      return NextResponse.json(
        { error: "Acesso negado: este código não pertence ao seu usuário." },
        { status: 403 }
      );
    }
    
    // 7) Verifica se o plano do usuário está ativo
    if (user.planStatus !== "active") {
      return NextResponse.json({ error: "Seu plano não está ativo." }, { status: 403 });
    }
    
    // 8) Vincula o phoneNumber e invalida o verificationCode
    user.whatsappPhone = phoneNumber;
    user.whatsappVerificationCode = null;
    await user.save();
    
    // 9) Retorna sucesso
    return NextResponse.json({ message: "Vinculação concluída com sucesso!" }, { status: 200 });
  } catch (error: unknown) {
    console.error("Erro em POST /api/whatsapp/verify:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Falha ao verificar código: ${errorMessage}` },
      { status: 500 }
    );
  }
}
