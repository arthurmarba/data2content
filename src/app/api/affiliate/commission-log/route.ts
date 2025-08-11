// src/app/api/affiliate/commission-log/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho se necessário
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User, { IUser, ICommissionLogEntry } from "@/app/models/User"; // Importa IUser e ICommissionLogEntry

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliate/commission-log
 * Retorna o histórico de comissões ganhas pelo usuário afiliado autenticado.
 * Opcionalmente, pode aceitar query params para paginação no futuro.
 */
export async function GET(request: NextRequest) {
  const TAG = "[api/affiliate/commission-log:GET]";

  try {
    await connectToDatabase();
    // console.debug(`${TAG} Conectado ao banco de dados.`);

    // 1. Obter a sessão do usuário
    // Usaremos getServerSession para ter acesso ao objeto User completo da sessão, se necessário,
    // mas para este caso, apenas o ID do usuário (token.sub) seria suficiente se usássemos getToken.
    const session = await getServerSession(authOptions);
    // console.debug(`${TAG} Sessão obtida:`, session);

    if (!session?.user?.id) {
      console.warn(`${TAG} Usuário não autenticado.`);
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const userId = session.user.id;

    // Validação adicional do ID do usuário (opcional, mas boa prática)
    if (!mongoose.isValidObjectId(userId)) {
      console.warn(`${TAG} ID de usuário inválido na sessão: ${userId}`);
      return NextResponse.json({ error: "ID de usuário inválido" }, { status: 400 });
    }

    // 2. Buscar o usuário e selecionar apenas o campo commissionLog
    // Adicionamos .lean() para melhor performance, pois não precisaremos de métodos do Mongoose aqui.
    const userWithLog = await User.findById(userId)
      .select("commissionLog")
      .lean<Pick<IUser, "commissionLog">>(); // Tipagem para o resultado do select + lean

    if (!userWithLog) {
      console.warn(`${TAG} Usuário não encontrado no banco de dados: ${userId}`);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // 3. Ordenar o log de comissões (mais recentes primeiro) e retornar
    // O Mongoose não ordena subdocumentos automaticamente na query principal desta forma.
    // A ordenação é feita aqui após buscar os dados.
    const commissionLog = userWithLog.commissionLog || [];
    const sortedLog = commissionLog.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // console.debug(`${TAG} Log de comissões encontrado para ${userId}, ${sortedLog.length} entradas.`);
    return NextResponse.json(sortedLog, { status: 200 });

  } catch (error: unknown) {
    console.error(`${TAG} Erro ao buscar log de comissões:`, error);
    const message = error instanceof Error ? error.message : "Erro desconhecido ao processar sua solicitação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
