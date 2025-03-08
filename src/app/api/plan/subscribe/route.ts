import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt"; // para autenticação
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

// Em vez de require(), use import para mercadopago
import mercadopago from "@/app/lib/mercadopago";

/**
 * POST /api/plan/subscribe
 * Cria uma preferência de pagamento no Mercado Pago.
 * Se houver affiliateCode válido, aplica desconto (ex.: 10%).
 * Marca o user como "pending" e salva affiliateUsed se for o caso.
 */
export async function POST(req: NextRequest) {
  try {
    // 1) Verifica se há token (usuário logado) via JWT
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Lê body com as informações de assinatura
    const body = (await req.json()) || {};
    const { planType, affiliateCode } = body;

    // 3) Conecta ao Mongo e busca o usuário via email do token
    await connectToDatabase();
    const user = await User.findOne({ email: token.email });
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // 4) Define o preço base
    let price = 19.9; // Exemplo para plano mensal
    if (planType === "annual") {
      // Ex.: R$12,90 x 12
      price = 12.9 * 12;
    }

    // 5) Se houver affiliateCode, valida e aplica desconto (10%)
    if (affiliateCode) {
      const affUser = await User.findOne({ affiliateCode });
      if (!affUser) {
        return NextResponse.json({ error: "Cupom de afiliado inválido." }, { status: 400 });
      }
      // Impede que o usuário use o próprio cupom
      if (affUser._id.equals(user._id)) {
        return NextResponse.json(
          { error: "Você não pode usar seu próprio cupom." },
          { status: 400 }
        );
      }
      // Aplica 10% de desconto
      price = parseFloat((price * 0.9).toFixed(2));

      // Marca o user.affiliateUsed
      user.affiliateUsed = affiliateCode;
    }

    // 6) Marca o plano como "pending"
    user.planStatus = "pending";
    await user.save();

    // 7) Cria a preference no Mercado Pago
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
      external_reference: user._id.toString(), // ID do user p/ webhook
    };

    // 8) Cria a preferência via SDK do MP
    const responseMP = await mercadopago.preferences.create(preference);
    const initPoint = responseMP.body.init_point;

    // 9) Retorna o link
    return NextResponse.json({
      initPoint,
      message: "Preferência criada. Redirecione o usuário para esse link.",
      price,
    });

  } catch (error: unknown) {
    console.error("Erro em /api/plan/subscribe:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
