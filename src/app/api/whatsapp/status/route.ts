// src/app/api/whatsapp/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { connectToDatabase } from "@/app/lib/mongoose";
import mongoose from "mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Util para autenticar de forma compatível com dev/prod
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // 1) Tenta via next-auth
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (token?.sub) return String(token.sub);
  } catch (e) {
    console.error("[whatsapp/status] getToken() error:", e);
  }

  // 2) Fallback: decodifica cookie manualmente
  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";
  const raw = request.cookies.get(cookieName)?.value;
  if (!raw) return null;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  try {
    const decoded = await jwtVerify(raw, new TextEncoder().encode(secret));
    const sub = decoded?.payload?.sub;
    return sub ? String(sub) : null;
  } catch (err) {
    console.error("[whatsapp/status] manual jwtVerify() error:", err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  // ❌ Removido: guardPremiumRequest — este endpoint é read-only e não deve bloquear por plano.

  console.log("[whatsapp/status] ▶︎ Request received");

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    await connectToDatabase();

    const doc = await User.findById(userId).select(
      "_id whatsappVerificationCode whatsappPhone whatsappVerified"
    );

    if (!doc) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Já vinculado
    if (doc.whatsappVerified === true && doc.whatsappPhone) {
      return NextResponse.json(
        { linked: true, phone: doc.whatsappPhone },
        { status: 200 }
      );
    }

    // Pendente com código
    if (doc.whatsappVerificationCode) {
      return NextResponse.json(
        { linked: false, pending: true, code: doc.whatsappVerificationCode },
        { status: 200 }
      );
    }

    // Não vinculado e sem código pendente
    return NextResponse.json(
      { linked: false, pending: false, code: null },
      { status: 200 }
    );
  } catch (err) {
    console.error("[whatsapp/status] Erro geral:", err);
    return NextResponse.json({ error: "Falha ao consultar status." }, { status: 500 });
  }
}
