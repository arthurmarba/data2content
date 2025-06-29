// src/app/api/admin/redemptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
// <<< ALTERAÇÃO 1: Importamos o modelo E a interface correta que criamos.
import Redemption, { IRedemption } from "@/app/models/Redemption";
import { Types } from "mongoose";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

// Interface para o usuário populado (pode ser mantida, pois é útil)
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

// <<< ALTERAÇÃO 2: A interface local e obsoleta IRedemptionDocument foi REMOVIDA.

// Interface para a sessão (pode ser mantida)
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
 * ... (descrição da rota)
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

    const filter: any = {};
    if (statusFilter !== 'all') {
      filter.status = statusFilter;
    }

    if (searchQuery) {
      const userSearchRegex = new RegExp(searchQuery, 'i');
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: userSearchRegex } },
          { email: { $regex: userSearchRegex } },
        ],
      }).select('_id');

      const userIds = matchingUsers.map(user => user._id);
      
      if (userIds.length === 0) {
        return NextResponse.json({ items: [], totalItems: 0, totalPages: 0, currentPage: 1, perPage: 20 });
      }

      // <<< ALTERAÇÃO 3: Usando o nome de campo correto 'userId' do novo modelo.
      filter.userId = { $in: userIds };
    }
    
    // <<< ALTERAÇÃO 4: A linha com o casting (as Model<...>) foi REMOVIDA. Usamos 'Redemption' diretamente.

    if (exportType === 'csv') {
      // Definimos um tipo para o documento após o populate para melhor type safety
      type PopulatedRedemption = Omit<IRedemption, 'userId'> & { userId: IPopulatedUserForRedemption };

      const redemptions = await Redemption
        .find(filter)
        // <<< ALTERAÇÃO 5: Populando 'userId' em vez de 'user'.
        .populate<{ userId: IPopulatedUserForRedemption }>({
          path: 'userId', model: User, select: 'name email paymentInfo',
        })
        // <<< ALTERAÇÃO 6: Ordenando por 'requestedAt' em vez de 'createdAt'.
        .sort({ requestedAt: -1 })
        .lean(); // Adicionado .lean() para melhor performance em leituras

      const csvDelimiter = ';';
      const csvHeaders = [
        "ID Resgate", "Data Solicitacao", "Status", "Nome Afiliado", "Email Afiliado",
        "Valor (BRL)", "Moeda", "Chave PIX", "Banco", "Agencia", "Conta", "Notas Admin"
      ];
      let csvContent = csvHeaders.join(csvDelimiter) + "\r\n";
      
      redemptions.forEach(r => {
        // Agora 'r' é um objeto simples e já tem o tipo correto inferido pelo .lean() e populate
        const user = r.userId as IPopulatedUserForRedemption;
        const paymentInfo = user.paymentInfo || {};
        const row = [
          escapeCsvValue(r._id.toString(), csvDelimiter),
          // <<< ALTERAÇÃO 7: Usando 'requestedAt'
          escapeCsvValue(new Date(r.requestedAt).toLocaleString('pt-BR'), csvDelimiter),
          escapeCsvValue(r.status, csvDelimiter),
          escapeCsvValue(user.name || '', csvDelimiter),
          escapeCsvValue(user.email || '', csvDelimiter),
          escapeCsvValue(r.amount.toFixed(2).replace('.', ','), csvDelimiter),
          escapeCsvValue(r.currency, csvDelimiter), // Campo adicionado
          escapeCsvValue(paymentInfo.pixKey || '', csvDelimiter),
          escapeCsvValue(paymentInfo.bankName || '', csvDelimiter),
          escapeCsvValue(paymentInfo.bankAgency || '', csvDelimiter),
          escapeCsvValue(paymentInfo.bankAccount || '', csvDelimiter),
          // <<< ALTERAÇÃO 8: Usando 'adminNotes'
          escapeCsvValue(r.adminNotes || '', csvDelimiter)
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
        Redemption.countDocuments(filter),
        Redemption
          .find(filter)
          // <<< ALTERAÇÃO 9: Populando 'userId'
          .populate<{ userId: IPopulatedUserForRedemption }>({
            path: 'userId', model: User, select: 'name email paymentInfo profilePictureUrl',
          })
          // <<< ALTERAÇÃO 10: Ordenando por 'requestedAt'
          .sort({ requestedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean() // Adicionado .lean() para melhor performance
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