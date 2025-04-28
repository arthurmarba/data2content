// src/app/api/admin/redemptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho se necessário
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User"; // Import User para popular os dados
import Redemption from "@/app/models/Redemption";
import { Model, Document } from "mongoose";

export const runtime = "nodejs";

// Reutiliza a interface IRedemption (pode ser movida para um arquivo de tipos compartilhado)
interface IRedemption extends Document {
  user: any; // Alterado para 'any' ou um tipo mais específico que inclua os campos populados
  amount: number;
  status: "pending" | "paid" | "canceled";
  paymentMethod: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

// Reutiliza a interface SessionUser
interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  id?: string;
}

/**
 * GET /api/admin/redemptions
 * Lista os pedidos de resgate (apenas para admin).
 * Aceita query param `status` (pending, paid, canceled, all). Default: 'pending'.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // 1. Verifica se o usuário é admin
    const session = await getServerSession({ req: request, ...authOptions });
    console.debug("[admin/redemptions:GET] Sessão:", session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const userSession = session.user as SessionUser;
    if (userSession.role !== 'admin') {
      return NextResponse.json({ error: "Acesso negado. Permissão de administrador necessária." }, { status: 403 });
    }

    // 2. Obtém o status do query param
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || 'pending'; // Default para 'pending'

    // 3. Monta o filtro para a query
    let queryFilter = {};
    if (statusFilter !== 'all') {
      queryFilter = { status: statusFilter };
    }

    // 4. Busca os resgates no banco, filtrando e populando dados do usuário
    const redemptionModel = Redemption as unknown as Model<IRedemption>;
    const redemptions = await redemptionModel
      .find(queryFilter)
      .populate({
        path: 'user', // Nome do campo no schema Redemption que referencia User
        model: User, // O modelo a ser usado para popular
        select: 'name email paymentInfo', // Campos do User a serem incluídos
      })
      .sort({ createdAt: -1 }); // Ordena pelos mais recentes

    // 5. Retorna a lista de resgates
    return NextResponse.json(redemptions, { status: 200 });

  } catch (error: unknown) {
    console.error("[admin/redemptions:GET] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
