import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import mercadopago from "@/app/lib/mercadopago";

export const runtime = "nodejs";
const isProd = process.env.NODE_ENV === "production";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession({ req, ...authOptions });
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });

    if (!user || !user.paymentGatewaySubscriptionId) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    try {
      await mercadopago.preapproval.update(user.paymentGatewaySubscriptionId, {
        status: "cancelled",
      });
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      const status = err?.status ?? err?.response?.status;
      const alreadyCancelled =
        status === 404 || msg.includes("not found") || msg.includes("already");
      if (!alreadyCancelled) {
        if (!isProd) console.error("plan/cancel -> erro no preapproval.update:", err);
        throw err;
      }
      if (!isProd)
        console.debug(
          "plan/cancel -> assinatura já cancelada ou inexistente, prosseguindo",
        );
    }

    user.planStatus = "non_renewing";
    await user.save();

    return NextResponse.json({
      message: "Assinatura cancelada."
    });
  } catch (error: unknown) {
    if (!isProd) console.error("Erro em /api/plan/cancel:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
