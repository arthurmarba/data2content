// src/app/api/admin/redemptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User, { IUser } from "@/app/models/User";
import Redemption from "@/app/models/Redemption";
import { Model, Document, Types } from "mongoose";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

// Interface para o usuário populado, mais específica
interface IPopulatedUserForRedemption {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  paymentInfo?: {
    pixKey?: string;
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
  };
}

// Interface IRedemption atualizada para usar o tipo de usuário populado
interface IRedemptionDocument extends Document {
  _id: Types.ObjectId;
  user: IPopulatedUserForRedemption | Types.ObjectId;
  amount: number;
  status: "pending" | "paid" | "canceled";
  paymentMethod: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  id?: string;
}

/**
 * Helper para escapar dados para CSV
 */
function escapeCsvValue(value: any, delimiter = ';'): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * GET /api/admin/redemptions
 * Lista os pedidos de resgate com paginação e busca (apenas para admin).
 * Aceita query params:
 * - `status` (pending, paid, canceled, all). Default: 'pending'.
 * - `searchQuery` (busca por nome ou e-mail do afiliado).
 * - `page` (número da página). Default: 1.
 * - `limit` (itens por página). Default: 20.
 * - `export=csv` para exportar todos os dados filtrados.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getServerSession({ req: request, ...authOptions });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const userSession = session.user as SessionUser;
    if (userSession.role !== 'admin') {
      return NextResponse.json({ error: "Acesso negado. Permissão de administrador necessária." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || 'pending';
    const searchQuery = searchParams.get("searchQuery");
    const exportType = searchParams.get("export");

    // --- Lógica de Filtro Aprimorada ---
    const filter: any = {};
    if (statusFilter !== 'all') {
      filter.status = statusFilter;
    }

    // Se houver uma busca, primeiro encontramos os usuários correspondentes
    if (searchQuery) {
      const userSearchRegex = new RegExp(searchQuery, 'i'); // 'i' para case-insensitive
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: userSearchRegex } },
          { email: { $regex: userSearchRegex } },
        ],
      }).select('_id');

      const userIds = matchingUsers.map(user => user._id);

      // Se a busca por usuários não retornou resultados, nenhum resgate será encontrado.
      if (userIds.length === 0) {
        return NextResponse.json({ items: [], totalItems: 0, totalPages: 0, currentPage: 1, perPage: 20 });
      }

      filter.user = { $in: userIds };
    }
    // --- Fim da Lógica de Filtro ---

    const redemptionModel = Redemption as Model<IRedemptionDocument>;

    if (exportType === 'csv') {
      const redemptions = await redemptionModel
        .find(filter)
        .populate<{ user: IPopulatedUserForRedemption }>({
          path: 'user', model: User, select: 'name email paymentInfo',
        })
        .sort({ createdAt: -1 });

      const csvDelimiter = ';';
      const csvHeaders = [
        "ID Resgate", "Data Solicitacao", "Status", "Nome Afiliado", "Email Afiliado",
        "Valor (BRL)", "Chave PIX", "Banco", "Agencia", "Conta", "Notas Admin"
      ];
      let csvContent = csvHeaders.join(csvDelimiter) + "\r\n";
      redemptions.forEach(r => {
        const user = r.user as IPopulatedUserForRedemption;
        const paymentInfo = user.paymentInfo || {};
        const row = [
          escapeCsvValue(r._id.toString(), csvDelimiter),
          escapeCsvValue(new Date(r.createdAt).toLocaleString('pt-BR'), csvDelimiter),
          escapeCsvValue(r.status, csvDelimiter),
          escapeCsvValue(user.name || '', csvDelimiter),
          escapeCsvValue(user.email || '', csvDelimiter),
          escapeCsvValue(r.amount.toFixed(2).replace('.', ','), csvDelimiter),
          escapeCsvValue(paymentInfo.pixKey || '', csvDelimiter),
          escapeCsvValue(paymentInfo.bankName || '', csvDelimiter),
          escapeCsvValue(paymentInfo.bankAgency || '', csvDelimiter),
          escapeCsvValue(paymentInfo.bankAccount || '', csvDelimiter),
          escapeCsvValue(r.notes || '', csvDelimiter)
        ];
        csvContent += row.join(csvDelimiter) + "\r\n";
      });

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="resgates_${statusFilter}_${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });

    } else {
      const page = parseInt(searchParams.get('page') ?? '1', 10);
      const limit = parseInt(searchParams.get('limit') ?? '20', 10);
      const skip = (page - 1) * limit;

      const [totalItems, items] = await Promise.all([
        redemptionModel.countDocuments(filter),
        redemptionModel
          .find(filter)
          .populate<{ user: IPopulatedUserForRedemption }>({
            path: 'user', model: User, select: 'name email paymentInfo profilePictureUrl',
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return NextResponse.json({
        items,
        totalItems,
        totalPages,
        currentPage: page,
        perPage: limit
      }, { status: 200 });
    }

  } catch (error: unknown) {
    console.error("[admin/redemptions:GET] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
