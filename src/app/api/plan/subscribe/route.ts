import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho conforme necessário
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import AgencyModel from "@/app/models/Agency";
import mercadopago from "@/app/lib/mercadopago";
import { Types } from "mongoose";
import {
  MONTHLY_PRICE,
  ANNUAL_MONTHLY_PRICE,
  AGENCY_GUEST_MONTHLY_PRICE,
  AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
} from "@/config/pricing.config";

export const runtime = "nodejs";

/**
 * POST /api/plan/subscribe
 * Cria uma assinatura no Mercado Pago.
 * Aplica desconto se houver affiliateCode válido.
 * Marca o usuário como "pending" e salva affiliateUsed, se aplicável.
 */
export async function POST(req: NextRequest) {
  try {
    // 1) Log de cookie para debug
    const rawCookie = req.headers.get("cookie");
    console.debug("plan/subscribe -> Cookie recebido:", rawCookie || "NENHUM COOKIE");

    // 2) Obtém a sessão usando getServerSession passando um objeto com req e as opções
    const session = await getServerSession({ req, ...authOptions });
    console.debug("plan/subscribe -> Sessão retornada:", session);

    if (!session?.user?.email) {
      console.error("plan/subscribe -> Falha de autenticação: session.user.email ausente");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Lê os dados do corpo da requisição
    const body = await req.json();
    const { planType = 'monthly', affiliateCode, agencyInviteCode } = body as {
      planType?: 'monthly' | 'annual';
      affiliateCode?: string;
      agencyInviteCode?: string;
    };
    console.debug("plan/subscribe -> Body recebido:", body);

    // 4) Conecta ao banco de dados e busca o usuário via email da sessão
    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.error("plan/subscribe -> Usuário não encontrado:", session.user.email);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // 5) Define o preço base considerando plano e convite de agência
    let monthlyPrice: number;
    let price: number;
    if (agencyInviteCode) {
      const agency = await AgencyModel.findOne({ inviteCode: agencyInviteCode });
      if (!agency) {
        console.error("plan/subscribe -> Código de agência inválido:", agencyInviteCode);
        return NextResponse.json({ error: "Código de agência inválido." }, { status: 400 });
      }
      if (agency.planStatus !== 'active') {
        console.error(`plan/subscribe -> Agência ${agency._id} com plano inativo`);
        return NextResponse.json({ error: 'Agência sem assinatura ativa.' }, { status: 403 });
      }

      if (user.agency && user.agency.toString() !== agency._id.toString()) {
        return NextResponse.json(
          { error: 'Usuário já vinculado a outra agência. Saia da atual antes de prosseguir.' },
          { status: 409 }
        );
      }

      const activeGuests = await User.countDocuments({
        agency: agency._id,
        role: { $ne: 'agency' },
        planStatus: 'active',
      });
      const useGuestPricing = activeGuests === 0;

      monthlyPrice =
        planType === 'annual'
          ? useGuestPricing
            ? AGENCY_GUEST_ANNUAL_MONTHLY_PRICE
            : ANNUAL_MONTHLY_PRICE
          : useGuestPricing
            ? AGENCY_GUEST_MONTHLY_PRICE
            : MONTHLY_PRICE;

      price = planType === 'annual' ? monthlyPrice * 12 : monthlyPrice;

      user.pendingAgency = agency._id;
    } else {
      monthlyPrice = planType === 'annual' ? ANNUAL_MONTHLY_PRICE : MONTHLY_PRICE;
      price = planType === 'annual' ? monthlyPrice * 12 : monthlyPrice;
    }

    // 6) Se houver affiliateCode, valida e aplica desconto (10%)
    if (affiliateCode) {
      const affUser = await User.findOne({ affiliateCode });
      if (!affUser) {
        console.error("plan/subscribe -> Cupom inválido:", affiliateCode);
        return NextResponse.json({ error: "Cupom de afiliado inválido." }, { status: 400 });
      }
      // Impede que o usuário use seu próprio cupom
      if ((affUser._id as Types.ObjectId).equals(user._id as Types.ObjectId)) {
        console.error("plan/subscribe -> Tentativa de uso do próprio cupom:", affiliateCode);
        return NextResponse.json(
          { error: "Você não pode usar seu próprio cupom." },
          { status: 400 }
        );
      }
      // Aplica desconto de 10%
      monthlyPrice = parseFloat((monthlyPrice * 0.9).toFixed(2));
      price = planType === 'annual' ? parseFloat((monthlyPrice * 12).toFixed(2)) : monthlyPrice;
      user.affiliateUsed = affiliateCode;
    }


    // 7) Atualiza o status do plano para "pending" e salva o usuário
    user.planStatus = "pending";
    await user.save();

    // 8) Cria a assinatura no Mercado Pago
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (!appUrl) {
      throw new Error(
        "NEXT_PUBLIC_APP_URL ou NEXTAUTH_URL não está definida"
      );
    }

    const preapprovalData = {
      reason: planType === "annual" ? "Plano Anual" : "Plano Mensal",
      back_url: `${appUrl}/dashboard`,
      external_reference: user._id.toString(), // Utilizado para o webhook
      payer_email: user.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: monthlyPrice,
        currency_id: "BRL",
      },
    } as any;

    const responseMP = await mercadopago.preapproval.create(preapprovalData);
    const initPoint = responseMP.body.init_point;
    const subscriptionId = responseMP.body.id;
    console.debug("plan/subscribe -> Assinatura criada. Link:", initPoint);

    user.paymentGatewaySubscriptionId = subscriptionId;
    user.planType = planType;
    await user.save();

    // 9) Retorna o link de pagamento, o id da assinatura e o preço aplicado
    return NextResponse.json({
      initPoint,
      subscriptionId,
      message: "Assinatura criada. Redirecione o usuário para esse link.",
      price,
    });
  } catch (error: unknown) {
    console.error("Erro em /api/plan/subscribe:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
