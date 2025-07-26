import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho conforme necessário
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import AgencyModel from "@/app/models/Agency";
import mercadopago from "@/app/lib/mercadopago";
import { Types } from "mongoose";

export const runtime = "nodejs";

/**
 * POST /api/plan/subscribe
 * Cria uma preferência de pagamento no Mercado Pago.
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
    const { planType, affiliateCode, agencyInviteCode } = body || {};
    console.debug("plan/subscribe -> Body recebido:", body);

    // 4) Conecta ao banco de dados e busca o usuário via email da sessão
    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.error("plan/subscribe -> Usuário não encontrado:", session.user.email);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // 5) Define o preço base com base no tipo de plano
    let price = 19.9; // preço mensal padrão
    if (planType === "annual") {
      price = 12.9 * 12;
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
      price = parseFloat((price * 0.9).toFixed(2));
      user.affiliateUsed = affiliateCode;
    }

    // 6.1) Se agencyInviteCode fornecido, vincula usuário à agência ativa e aplica desconto
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

      user.pendingAgency = agency._id;
      price = parseFloat((price * 0.9).toFixed(2));
    }

    // 7) Atualiza o status do plano para "pending" e salva o usuário
    user.planStatus = "pending";
    await user.save();

    // 8) Cria a preferência no Mercado Pago
    const preference = {
      items: [
        {
          title: planType === "annual" ? "Plano Anual" : "Plano Mensal",
          quantity: 1,
          currency_id: "BRL",
          unit_price: price,
        },
      ],
      payer: {
        email: user.email,
      },
      back_urls: {
        success: "https://seusite.com/dashboard",
        failure: "https://seusite.com/dashboard",
        pending: "https://seusite.com/dashboard",
      },
      auto_return: "approved",
      external_reference: user._id.toString(), // Utilizado para o webhook
    };

    const responseMP = await mercadopago.preferences.create(preference);
    const initPoint = responseMP.body.init_point;
    console.debug("plan/subscribe -> Preferência criada. Link:", initPoint);

    // 9) Retorna o link de pagamento e o preço aplicado
    return NextResponse.json({
      initPoint,
      message: "Preferência criada. Redirecione o usuário para esse link.",
      price,
    });
  } catch (error: unknown) {
    console.error("Erro em /api/plan/subscribe:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
