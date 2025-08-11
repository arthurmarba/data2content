// src/app/api/affiliate/redeem/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User"; // Assume que User tem a role
import Redemption from "@/app/models/Redemption";
import { Model, Document, Types } from "mongoose"; // Types importado para _id
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";
import { normCur } from "@/utils/normCur";

export const runtime = "nodejs";

/**
 * Interface para o documento de Redemption.
 */
interface IRedemptionDocument extends Document { // Renomeado para IRedemptionDocument para clareza
  _id: Types.ObjectId; // Adicionado _id
  user: string | Types.ObjectId; // Pode ser string ou ObjectId
  amount: number;
  status: "pending" | "paid" | "canceled";
  paymentMethod: string;
  notes: string; // Este campo será usado para as notas do admin
  currency?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tipo auxiliar para o usuário na sessão, incluindo a role.
 */
interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  id?: string;
}

// --- GET e POST (sem alterações, mantidos como no seu arquivo original) ---

/**
 * GET /api/affiliate/redeem?userId=...
 * Lista os saques do usuário logado.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getServerSession(authOptions);
    // console.debug("[redeem:GET] Sessão:", session);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Faltou userId" }, { status: 400 });
    }

    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    const redemptionModel = Redemption as unknown as Model<IRedemptionDocument>;
    const redemptions = await redemptionModel.find({ user: userId }).sort({ createdAt: -1 });

    return NextResponse.json(redemptions, { status: 200 });
  } catch (error: unknown) {
    console.error("[redeem:GET] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/affiliate/redeem
 * Cria solicitação de saque para o usuário logado.
 * Body: { userId }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getServerSession(authOptions);
    // console.debug("[redeem:POST] Sessão:", session);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const ip = getClientIp(request);
    const { allowed } = await checkRateLimit(`redeem_post:${session.user.id}:${ip}`, 1, 10);
    if (!allowed) {
      return NextResponse.json({ error: 'Muitas tentativas, tente novamente mais tarde.' }, { status: 429 });
    }

    const body = await request.json();
    const { userId, currency } = body || {};
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro userId é obrigatório." }, { status: 400 });
    }

    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const { pixKey, bankName, bankAgency, bankAccount } = user.paymentInfo || {};
    const hasPaymentInfo = !!(pixKey || bankName || bankAgency || bankAccount);
    if (!hasPaymentInfo) {
      return NextResponse.json(
        { error: "É preciso preencher os dados bancários antes de solicitar o saque." },
        { status: 400 }
      );
    }

    const cur = normCur(currency);
    user.affiliateBalances ||= new Map();
    const balanceCents = user.affiliateBalances.get(cur) ?? 0;

    const MINIMUM_REDEEM_AMOUNT_CENTS = 50 * 100;
    if (balanceCents < MINIMUM_REDEEM_AMOUNT_CENTS) {
      return NextResponse.json(
        { error: `Saldo insuficiente em ${cur.toUpperCase()}. Mínimo é ${(MINIMUM_REDEEM_AMOUNT_CENTS/100).toFixed(2)}.` },
        { status: 400 }
      );
    }

    const amount = balanceCents / 100;
    const redemptionModel = Redemption as unknown as Model<IRedemptionDocument>;
    const newRedemption = await redemptionModel.create({
      user: user._id,
      amount,
      status: "pending",
      paymentMethod: "",
      notes: "",
      currency: cur,
    });

    user.affiliateBalances.set(cur, 0);
    user.markModified('affiliateBalances');
    await user.save();

    return NextResponse.json({
      message: "Solicitação de resgate criada com sucesso!",
      redemption: newRedemption,
    });
  } catch (error: unknown) {
    console.error("[redeem:POST] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


/**
 * PATCH /api/affiliate/redeem
 * Atualiza o status e/ou notas do saque (apenas admin).
 * Body: { redeemId, newStatus, adminNotes? }
 */
export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getServerSession(authOptions);
    // console.debug("[redeem:PATCH] Sessão:", session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const userSession = session.user as SessionUser;
    if (userSession.role !== 'admin') {
        return NextResponse.json({ error: "Acesso negado. Permissão de administrador necessária." }, { status: 403 });
    }

    const body = await request.json();
    // <<< MODIFICAÇÃO: Extrai adminNotes do corpo >>>
    const { redeemId, newStatus, adminNotes } = body || {};

    if (!redeemId) { // Apenas redeemId é estritamente obrigatório para buscar
      return NextResponse.json(
        { error: "Parâmetro redeemId é obrigatório." },
        { status: 400 }
      );
    }
    // newStatus e adminNotes são opcionais; pode-se querer atualizar só um ou outro.
    // Mas geralmente, ao menos um deles será fornecido para uma ação de PATCH.
    if (!newStatus && typeof adminNotes === 'undefined') {
        return NextResponse.json(
          { error: "É necessário fornecer newStatus ou adminNotes para atualização." },
          { status: 400 }
        );
    }


    const redemptionModel = Redemption as unknown as Model<IRedemptionDocument>;
    const redemption = await redemptionModel.findById(redeemId);
    if (!redemption) {
      return NextResponse.json({ error: "Resgate não encontrado." }, { status: 404 });
    }

    let hasChanges = false;

    // Atualiza o status se newStatus for fornecido
    if (newStatus) {
      const validStatuses = ['pending', 'paid', 'canceled'];
      if (!validStatuses.includes(newStatus)) {
           return NextResponse.json({ error: `Status inválido: ${newStatus}` }, { status: 400 });
      }
      if (redemption.status !== newStatus) {
        redemption.status = newStatus;
        hasChanges = true;
      }
    }

    // <<< MODIFICAÇÃO: Atualiza as notas se adminNotes for fornecido >>>
    // Verifica se adminNotes foi passado (pode ser uma string vazia para limpar notas)
    if (typeof adminNotes === 'string') {
      const trimmedAdminNotes = adminNotes.trim();
      if (redemption.notes !== trimmedAdminNotes) {
        redemption.notes = trimmedAdminNotes; // Usa o campo 'notes' existente
        hasChanges = true;
        // console.debug(`[redeem:PATCH] Notas atualizadas para o resgate ${redeemId}: "${redemption.notes}"`);
      }
    }

    if (hasChanges) {
      await redemption.save();
    } else {
      // console.debug(`[redeem:PATCH] Nenhuma alteração detectada para o resgate ${redeemId}.`);
    }
    
    return NextResponse.json({
      message: `Resgate atualizado com sucesso!`, // Mensagem genérica se nenhuma alteração específica foi feita
      redemption,
    });

  } catch (error: unknown) {
    console.error("[redeem:PATCH] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}