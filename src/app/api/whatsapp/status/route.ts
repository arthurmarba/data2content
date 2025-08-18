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
    const uid = (token as any)?.id ?? (token as any)?.sub;
    if (uid) return String(uid);
  } catch (e) {
    console.error("[whatsapp/status] getToken() error:", e);
  }

  // 2) Fallback: decodifica cookie manualmente
  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";
  const raw = request.cookies.get(cookieName)?.value;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!raw || !secret) return null;

  try {
    const decoded = await jwtVerify(raw, new TextEncoder().encode(secret));
    const payload = decoded?.payload as any;
    const uid = payload?.id ?? payload?.sub;
    return uid ? String(uid) : null;
  } catch (err) {
    console.error("[whatsapp/status] manual jwtVerify() error:", err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  // (Sem guardPremiumRequest) — é apenas leitura do estado de vinculação.
  console.log("[whatsapp/status] ▶︎ Request received");

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    await connectToDatabase();

    const doc = await User.findById(userId).select(
      "_id whatsappVerificationCode whatsappPhone whatsappVerified"
    );

    if (!doc) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Já vinculado
    if (doc.whatsappVerified === true && doc.whatsappPhone) {
      return NextResponse.json(
        { linked: true, phone: doc.whatsappPhone },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Pendente com código
    if (doc.whatsappVerificationCode) {
      return NextResponse.json(
        { linked: false, pending: true, code: doc.whatsappVerificationCode },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Não vinculado e sem código pendente
    return NextResponse.json(
      { linked: false, pending: false, code: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[whatsapp/status] Erro geral:", err);
    return NextResponse.json(
      { error: "Falha ao consultar status." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
