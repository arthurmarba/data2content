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

// ---- helpers contra float ----
const toCents = (v: number) => Math.round(v * 100); // trata 29.9 -> 2990
const fromCents = (c: number) => Number((c / 100).toFixed(2)); // garante 2 casas

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

    // 2) Obtém a sessão
    const session = await getServerSession({ req, ...authOptions });
    console.debug("plan/subscribe -> Sessão retornada:", session);

    if (!session?.user?.email) {
      console.error("plan/subscribe -> Falha de autenticação: session.user.email ausente");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Lê o corpo
    const body = await req.json();
    const { planType = "monthly", affiliateCode, agencyInviteCode, autoRenewConsent } = body as {
  planType?: "monthly" | "annual";
  affiliateCode?: string;
  agencyInviteCode?: string;
  autoRenewConsent?: boolean;
};
    console.debug("plan/subscribe -> Body recebido:", body);

    // exige consentimento explícito de renovação automática
    if (!autoRenewConsent) {
      return NextResponse.json({ error: "É necessário aceitar a renovação automática." }, { status: 400 });
    }

    // 4) DB + usuário
    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.error("plan/subscribe -> Usuário não encontrado:", session.user.email);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // 5) precificação em CENTAVOS sempre
    let monthlyBase = planType === "annual" ? ANNUAL_MONTHLY_PRICE : MONTHLY_PRICE;
    let isAgencyGuest = false;

    if (agencyInviteCode) {
      const agency = await AgencyModel.findOne({ inviteCode: agencyInviteCode });
      if (!agency) {
        console.error("plan/subscribe -> Código de agência inválido:", agencyInviteCode);
        return NextResponse.json({ error: "Código de agência inválido." }, { status: 400 });
      }
      if (agency.planStatus !== "active") {
        console.error(`plan/subscribe -> Agência ${agency._id} com plano inativo`);
        return NextResponse.json({ error: "Agência sem assinatura ativa." }, { status: 403 });
      }
      if (user.agency && user.agency.toString() !== agency._id.toString()) {
        return NextResponse.json(
          { error: "Usuário já vinculado a outra agência. Saia da atual antes de prosseguir." },
          { status: 409 }
        );
      }

      const activeGuests = await User.countDocuments({
        agency: agency._id,
        role: { $ne: "agency" },
        planStatus: "active",
      });
      isAgencyGuest = activeGuests === 0;

      if (planType === "annual") {
        monthlyBase = isAgencyGuest ? AGENCY_GUEST_ANNUAL_MONTHLY_PRICE : ANNUAL_MONTHLY_PRICE;
      } else {
        monthlyBase = isAgencyGuest ? AGENCY_GUEST_MONTHLY_PRICE : MONTHLY_PRICE;
      }

      user.pendingAgency = agency._id;
    }

    // centavos
    let monthlyCents = toCents(monthlyBase);
    let totalCents = planType === "annual" ? monthlyCents * 12 : monthlyCents;

    // 6) affiliate desconto 10%
    if (affiliateCode) {
      const affUser = await User.findOne({ affiliateCode });
      if (!affUser) {
        console.error("plan/subscribe -> Cupom inválido:", affiliateCode);
        return NextResponse.json({ error: "Cupom de afiliado inválido." }, { status: 400 });
      }
      if ((affUser._id as Types.ObjectId).equals(user._id as Types.ObjectId)) {
        console.error("plan/subscribe -> Tentativa de uso do próprio cupom:", affiliateCode);
        return NextResponse.json({ error: "Você não pode usar seu próprio cupom." }, { status: 400 });
      }
      // aplica 10% em centavos (arredonda corretamente)
      monthlyCents = Math.round((monthlyCents * 90) / 100);
      totalCents = planType === "annual" ? monthlyCents * 12 : monthlyCents;
      user.affiliateUsed = affiliateCode;
    }

    const monthly = fromCents(monthlyCents);
    const total = fromCents(totalCents);

    // 7) status pendente
    user.planStatus = "pending";
    user.autoRenewConsentAt = new Date();
    await user.save();

    // 8) Preapproval no Mercado Pago
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL ou NEXTAUTH_URL não está definida");

    // Para recorrência mensal, sempre usamos o valor mensal (no anual é o mensal com desconto)
    const txAmount = monthly; // número com 2 casas (apenas p/ logs)

    console.debug("plan/subscribe -> Valores:", {
      planType,
      monthlyBase,
      monthly: monthly.toFixed(2),
      total: total.toFixed(2),
      txAmount: txAmount.toFixed(2),
    });

    // Sempre recorrência mensal. No plano annual cobramos o mensal com desconto (12x sem juros - recorrente)
    const preapprovalData = {
      reason:
        planType === "annual"
          ? "Plano Anual (12x sem juros - recorrente)"
          : "Plano Mensal",
      back_url: `${appUrl}/dashboard`,
      external_reference: user._id.toString(),
      payer_email: user.email,
      auto_recurring: {
        frequency: 1, // mensal
        frequency_type: "months",
        transaction_amount: monthly, // mensal (com desconto se annual)
        currency_id: "BRL",
      },
    } as any;

    // Se já existe assinatura no gateway, cancela para evitar duplicidade
    if (user.paymentGatewaySubscriptionId) {
      try {
        await mercadopago.preapproval.update(user.paymentGatewaySubscriptionId, {
          status: "cancelled",
        });
      } catch {}
      user.paymentGatewaySubscriptionId = undefined;
    }

    const responseMP = await mercadopago.preapproval.create(preapprovalData);
    const initPoint = responseMP.body.init_point;
    const subscriptionId = responseMP.body.id;
    console.debug("plan/subscribe -> Assinatura criada. Link:", initPoint);

    user.paymentGatewaySubscriptionId = subscriptionId;
    user.planType = planType;
    await user.save();

    // 9) Retorno
    return NextResponse.json({
      initPoint,
      subscriptionId,
      message: "Assinatura criada. Redirecione o usuário para esse link.",
      price: planType === "annual" ? total : monthly,
    });
  } catch (error: unknown) {
    console.error("Erro em /api/plan/subscribe:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
