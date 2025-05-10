// src/app/api/admin/affiliates/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho se necessário
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User, { IUser } from "@/app/models/User";

export const runtime = "nodejs";

// Define uma interface para o usuário da sessão com a role
interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  id?: string;
}

// Define uma interface para os dados do afiliado que serão retornados
interface AffiliateData {
  _id: string;
  name?: string;
  email: string;
  affiliateCode?: string;
  affiliateBalance?: number;
  affiliateInvites?: number;
  affiliateRank?: number;
  planStatus?: string;
  createdAt?: string; // Data como string ISO
}

/**
 * GET /api/admin/affiliates
 * Lista usuários com seus dados de afiliado (apenas para admin).
 * Suporta paginação, filtros e ordenação.
 * Query Params:
 * - page?: número da página (default: 1)
 * - limit?: número de itens por página (default: 10)
 * - sortBy?: campo para ordenar (default: createdAt)
 * - sortOrder?: 'asc' ou 'desc' (default: desc)
 * - searchQuery?: termo para buscar em email ou affiliateCode
 * - filterByPlanStatus?: filtra por status do plano (ex: 'active', 'inactive')
 */
export async function GET(request: NextRequest) {
  const TAG = "[api/admin/affiliates:GET]";

  try {
    await connectToDatabase();
    // console.debug(`${TAG} Conectado ao banco de dados.`);

    // 1. Autenticação e Autorização (Admin)
    const session = await getServerSession({ req: request, ...authOptions });
    // console.debug(`${TAG} Sessão obtida:`, session);

    if (!session?.user?.id) {
      console.warn(`${TAG} Usuário não autenticado.`);
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const userSession = session.user as SessionUser;
    if (userSession.role !== 'admin') {
      console.warn(`${TAG} Acesso negado. Usuário ${userSession.email} não é admin.`);
      return NextResponse.json({ error: "Acesso negado. Permissão de administrador necessária." }, { status: 403 });
    }

    // 2. Extrair parâmetros da query para paginação, ordenação e filtros
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1; // 1 para asc, -1 para desc
    const searchQuery = searchParams.get("searchQuery")?.trim();
    const filterByPlanStatus = searchParams.get("filterByPlanStatus")?.trim();

    // 3. Construir o filtro da query (Mongoose)
    const queryFilter: mongoose.FilterQuery<IUser> = {};

    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'i'); // Case-insensitive search
      queryFilter.$or = [
        { email: regex },
        { name: regex }, // Adicionado filtro por nome
        { affiliateCode: regex }
      ];
    }

    if (filterByPlanStatus && filterByPlanStatus !== 'all') {
        queryFilter.planStatus = filterByPlanStatus;
    }
    
    // Filtro para garantir que estamos buscando apenas usuários que podem ser afiliados
    // (ex: todos os usuários, ou apenas aqueles que já fizeram uma indicação, etc.)
    // Por enquanto, vamos listar todos os usuários, pois todos recebem um affiliateCode.
    // queryFilter.affiliateCode = { $exists: true, $ne: null };


    // 4. Contar o total de documentos para paginação
    const totalAffiliates = await User.countDocuments(queryFilter);

    // 5. Buscar os usuários com paginação, ordenação e seleção de campos
    const affiliates = await User.find(queryFilter)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id name email affiliateCode affiliateBalance affiliateInvites affiliateRank planStatus createdAt')
      .lean<IUser[]>(); // Usar IUser aqui, pois é o que o modelo retorna

    // 6. Formatar os dados para a resposta
    const formattedAffiliates: AffiliateData[] = affiliates.map(aff => ({
      _id: aff._id.toString(),
      name: aff.name,
      email: aff.email,
      affiliateCode: aff.affiliateCode,
      affiliateBalance: aff.affiliateBalance || 0,
      affiliateInvites: aff.affiliateInvites || 0,
      affiliateRank: aff.affiliateRank || 1,
      planStatus: aff.planStatus || 'inactive',
      createdAt: aff.createdAt ? new Date(aff.createdAt).toISOString() : new Date().toISOString(),
    }));

    // console.debug(`${TAG} ${affiliates.length} afiliados encontrados. Total: ${totalAffiliates}`);
    return NextResponse.json({
      affiliates: formattedAffiliates,
      currentPage: page,
      totalPages: Math.ceil(totalAffiliates / limit),
      totalAffiliates,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error(`${TAG} Erro ao buscar lista de afiliados:`, error);
    const message = error instanceof Error ? error.message : "Erro desconhecido ao processar sua solicitação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
