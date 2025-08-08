import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import AgencyModel from "@/app/models/Agency";
import mercadopago from "@/app/lib/mercadopago";
import { Types } from "mongoose";
import {
  ANNUAL_MONTHLY_PRICE,
  AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
} from "@/config/pricing.config";

export const runtime = "nodejs";

// helpers to avoid float issues
const toCents = (v: number) => Math.round(v * 100);
const fromCents = (c: number) => Number((c / 100).toFixed(2));

/**
 * POST /api/plan/subscribe-one-time
 * Cria uma checkout preference para o plano anual parcelado (12x sem juros).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession({ req, ...authOptions });
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      planType = "annual_one_time",
      affiliateCode,
      agencyInviteCode,
    } = body as {
      planType?: "annual_one_time";
      affiliateCode?: string;
      agencyInviteCode?: string;
    };

    if (planType !== "annual_one_time") {
      return NextResponse.json({ error: "Tipo de plano inválido" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    let monthlyBase = ANNUAL_MONTHLY_PRICE;
    let isAgencyGuest = false;

    if (agencyInviteCode) {
      const agency = await AgencyModel.findOne({ inviteCode: agencyInviteCode });
      if (!agency) {
        return NextResponse.json({ error: "Código de agência inválido." }, { status: 400 });
      }
      if (agency.planStatus !== "active") {
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
      monthlyBase = isAgencyGuest ? AGENCY_GUEST_ANNUAL_MONTHLY_PRICE : ANNUAL_MONTHLY_PRICE;
      user.pendingAgency = agency._id;
    }

    let monthlyCents = toCents(monthlyBase);
    let totalCents = monthlyCents * 12;

    if (affiliateCode) {
      const affUser = await User.findOne({ affiliateCode });
      if (!affUser) {
        return NextResponse.json({ error: "Cupom de afiliado inválido." }, { status: 400 });
      }
      if ((affUser._id as Types.ObjectId).equals(user._id as Types.ObjectId)) {
        return NextResponse.json({ error: "Você não pode usar seu próprio cupom." }, { status: 400 });
      }
      monthlyCents = Math.round((monthlyCents * 90) / 100);
      totalCents = monthlyCents * 12;
      user.affiliateUsed = affiliateCode;
    }

    const total = fromCents(totalCents);

    user.planStatus = "pending";
    user.planType = "annual_one_time";
    await user.save();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (!appUrl) {
      throw new Error("NEXT_PUBLIC_APP_URL ou NEXTAUTH_URL não está definida");
    }

    const preference = {
      items: [
        {
          title: "Plano Anual Data2Content",
          unit_price: total,
          quantity: 1,
        },
      ],
      payer: { email: user.email },
      external_reference: user._id.toString(),
      notification_url: `${appUrl}/api/plan/webhook`,
      back_urls: {
        success: `${appUrl}/dashboard`,
        pending: `${appUrl}/dashboard`,
        failure: `${appUrl}/dashboard`,
      },
      auto_return: "approved",
      payment_methods: {
        installments: 12,
        default_installments: 12,
      },
      differential_pricing: { id: Number(process.env.MP_DIFF_PRICING_ID) || undefined },
      metadata: {
        planType: "annual_one_time",
        affiliateCode: affiliateCode || undefined,
        agencyInviteCode: agencyInviteCode || undefined,
      },
    } as any;

    const responseMP = await mercadopago.preferences.create({ body: preference });
    const initPoint = responseMP.body.init_point;

    return NextResponse.json({
      initPoint,
      message: "Checkout criado. Redirecionando...",
      price: total,
    });
  } catch (error: unknown) {
    console.error("Erro em /api/plan/subscribe-one-time:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

