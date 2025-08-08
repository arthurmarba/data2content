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

    // 2) Obtém a sessão
    const session = await getServerSession({ req, ...authOptions });

    if (process.env.NODE_ENV !== "production") {
      console.debug("plan/subscribe -> Cookie recebido:", rawCookie || "NENHUM COOKIE");
      console.debug("plan/subscribe -> Sessão retornada:", session);
    }

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

    // 6) cancela assinatura existente no gateway para evitar duplicidade
    if (user.paymentGatewaySubscriptionId) {
      try {
        await mercadopago.preapproval.update(user.paymentGatewaySubscriptionId, {
          status: "cancelled",
        });
      } catch {}
      user.paymentGatewaySubscriptionId = undefined;
    }

    // 7) limpa erro anterior e registra consentimento
    user.lastPaymentError = undefined;
    user.autoRenewConsentAt = new Date();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL ou NEXTAUTH_URL não está definida");

    if (planType === "annual") {
      // ---- fluxo ANUAL: cobrança única agora via preference ----
      let annualCents = toCents(monthlyBase) * 12;

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
        annualCents = Math.round(annualCents * 0.9);
        user.affiliateUsed = affiliateCode;
      }

      const annualTotal = fromCents(annualCents);

      const pref = await mercadopago.preferences.create({
        items: [
          {
            title: "Plano Anual Data2Content",
            quantity: 1,
            currency_id: "BRL",
            unit_price: annualTotal,
          },
        ],
        back_urls: {
          success: `${appUrl}/dashboard?from=mp`,
          pending: `${appUrl}/dashboard?from=mp`,
          failure: `${appUrl}/dashboard?from=mp`,
        },
        auto_return: "approved",
        external_reference: user._id.toString(),
        payer: { email: user.email },
        payment_methods: {
          installments: 12,
          default_installments: 12,
        },
        // differential_pricing: { id: Number(process.env.MP_12X_NO_INTEREST_ID) },
        metadata: {
          planType: "annual_upfront",
          commission_base_cents: annualCents,
          renew_full_cents: toCents(
            (agencyInviteCode ? AGENCY_GUEST_ANNUAL_MONTHLY_PRICE : ANNUAL_MONTHLY_PRICE) * 12,
          ),
        },
      });

      user.planStatus = "pending";
      user.planType = "annual";
      await user.save();

      return NextResponse.json({
        initPoint: pref.body.init_point,
        preferenceId: pref.body.id,
        message: "Assinatura criada. Redirecione o usuário para esse link.",
        chargedAnnualPrice: annualTotal,
        planBillingCycle: "annual",
      });
    }

    // ---- fluxo MENSAL (como antes) ----
    let monthlyCents = toCents(monthlyBase);

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
      monthlyCents = Math.round((monthlyCents * 90) / 100);
      user.affiliateUsed = affiliateCode;
    }

    const monthly = fromCents(monthlyCents);

    const preapprovalData = {
      reason: "Plano Mensal",
      back_url: `${appUrl}/dashboard?from=mp`,
      external_reference: user._id.toString(),
      payer_email: user.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: monthly,
        currency_id: "BRL",
      },
    } as any;

    const responseMP = await mercadopago.preapproval.create(preapprovalData);
    const initPoint = responseMP.body.init_point;
    const subscriptionId = responseMP.body.id;
    console.debug("plan/subscribe -> Assinatura criada. Link:", initPoint);

    user.paymentGatewaySubscriptionId = subscriptionId;
    user.planType = planType;
    user.planStatus = "pending";
    await user.save();

    return NextResponse.json({
      initPoint,
      subscriptionId,
      message: "Assinatura criada. Redirecione o usuário para esse link.",
      chargedMonthlyPrice: monthly,
      planBillingCycle: "monthly",
    });
  } catch (error: unknown) {
    console.error("Erro em /api/plan/subscribe:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
