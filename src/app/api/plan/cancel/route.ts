import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import mercadopago from "@/app/lib/mercadopago";

export const runtime = "nodejs";

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

    await mercadopago.preapproval.update(user.paymentGatewaySubscriptionId, { status: "cancelled" });

    user.planStatus = "canceled";
    user.paymentGatewaySubscriptionId = undefined;
    user.planType = undefined;
    user.planExpiresAt = null;
    await user.save();

    return NextResponse.json({ message: "Assinatura cancelada." });
  } catch (error: unknown) {
    console.error("Erro em /api/plan/cancel:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
