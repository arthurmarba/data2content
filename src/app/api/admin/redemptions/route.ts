// src/app/api/admin/redemptions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User, { IUser } from "@/app/models/User"; // IUser importado para tipagem mais forte
import Redemption from "@/app/models/Redemption";
import { Model, Document, Types } from "mongoose"; // Types importado

export const runtime = "nodejs";

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
  _id: Types.ObjectId; // Adicionado _id para o resgate
  user: IPopulatedUserForRedemption | Types.ObjectId; // Pode ser populado ou apenas ObjectId
  amount: number;
  status: "pending" | "paid" | "canceled";
  paymentMethod: string; // Pode ser preenchido posteriormente
  notes: string; // Para notas do admin
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
 * Helper para escapar dados para CSV (simples, envolve com aspas se contiver delimitador ou aspas)
 */
function escapeCsvValue(value: any, delimiter = ';'): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  // Se o valor contém o delimitador, quebras de linha ou aspas, envolve com aspas duplas
  // e duplica quaisquer aspas duplas existentes dentro do valor.
  if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}


/**
 * GET /api/admin/redemptions
 * Lista os pedidos de resgate (apenas para admin).
 * Aceita query param `status` (pending, paid, canceled, all). Default: 'pending'.
 * Aceita query param `export=csv` para exportar os dados.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getServerSession({ req: request, ...authOptions });
    // console.debug("[admin/redemptions:GET] Sessão:", session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const userSession = session.user as SessionUser;
    if (userSession.role !== 'admin') {
      return NextResponse.json({ error: "Acesso negado. Permissão de administrador necessária." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || 'pending';
    const exportType = searchParams.get("export"); // Verifica se a exportação é solicitada

    let queryFilter = {};
    if (statusFilter !== 'all') {
      queryFilter = { status: statusFilter };
    }

    const redemptionModel = Redemption as Model<IRedemptionDocument>;
    const redemptions = await redemptionModel
      .find(queryFilter)
      .populate<{ user: IPopulatedUserForRedemption }>({ // Tipagem mais forte para o populate
        path: 'user',
        model: User,
        select: 'name email paymentInfo',
      })
      .sort({ createdAt: -1 });

    if (exportType === 'csv') {
      // Lógica para exportação CSV
      const csvDelimiter = ';';
      const csvHeaders = [
        "ID Resgate",
        "Data Solicitacao",
        "Status",
        "Nome Afiliado",
        "Email Afiliado",
        "Valor (BRL)",
        "Chave PIX",
        "Banco",
        "Agencia",
        "Conta",
        "Notas Admin"
      ];

      let csvContent = csvHeaders.join(csvDelimiter) + "\r\n";

      redemptions.forEach(r => {
        const user = r.user as IPopulatedUserForRedemption; // Agora sabemos que está populado
        const paymentInfo = user.paymentInfo || {};
        const row = [
          escapeCsvValue(r._id.toString(), csvDelimiter),
          escapeCsvValue(new Date(r.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), csvDelimiter),
          escapeCsvValue(r.status, csvDelimiter),
          escapeCsvValue(user.name || '', csvDelimiter),
          escapeCsvValue(user.email || '', csvDelimiter),
          escapeCsvValue(r.amount.toFixed(2).replace('.', ','), csvDelimiter), // Formato BRL para CSV
          escapeCsvValue(paymentInfo.pixKey || '', csvDelimiter),
          escapeCsvValue(paymentInfo.bankName || '', csvDelimiter),
          escapeCsvValue(paymentInfo.bankAgency || '', csvDelimiter),
          escapeCsvValue(paymentInfo.bankAccount || '', csvDelimiter),
          escapeCsvValue(r.notes || '', csvDelimiter) // Inclui o campo 'notes' existente
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
      // Retorna JSON como antes
      return NextResponse.json(redemptions, { status: 200 });
    }

  } catch (error: unknown) {
    console.error("[admin/redemptions:GET] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}