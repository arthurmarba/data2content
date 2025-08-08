import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";
const isProd = process.env.NODE_ENV === "production";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession({ req, ...authOptions });
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne(
      { email: session.user.email },
      { lastPaymentError: 1 },
    ).lean();

    return NextResponse.json({ lastPaymentError: user?.lastPaymentError ?? null });
  } catch (error: unknown) {
    if (!isProd) console.error("Erro em /api/plan/last-error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
