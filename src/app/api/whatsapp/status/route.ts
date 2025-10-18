// src/app/api/whatsapp/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { connectToDatabase } from "@/app/lib/mongoose";
import mongoose from "mongoose";
import User from "@/app/models/User";

const WHATSAPP_TRIAL_ENABLED =
  String(
    process.env.WHATSAPP_TRIAL_ENABLED ??
      process.env.NEXT_PUBLIC_WHATSAPP_TRIAL_ENABLED ??
      "true"
  )
    .toLowerCase()
    .trim() !== "false";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Util para autenticar de forma compatível com dev/prod
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // 1) Tenta via next-auth
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (token && !(token as any).id && (token as any).sub) {
      (token as any).id = String((token as any).sub);
    }
    const uid = (token as any)?.id;
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
      "_id whatsappVerificationCode whatsappVerificationCodeExpiresAt whatsappPhone whatsappVerified whatsappTrialActive whatsappTrialEligible whatsappTrialStartedAt whatsappTrialExpiresAt"
    );

    if (!doc) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const now = Date.now();
    const trialExpiresAt =
      doc.whatsappTrialExpiresAt instanceof Date
        ? doc.whatsappTrialExpiresAt
        : doc.whatsappTrialExpiresAt
        ? new Date(doc.whatsappTrialExpiresAt)
        : null;
    const trialActiveFromWhatsapp =
      WHATSAPP_TRIAL_ENABLED &&
      Boolean(doc.whatsappTrialActive) &&
      (!trialExpiresAt || trialExpiresAt.getTime() > now);
    const trialStarted = Boolean(doc.whatsappTrialStartedAt) || trialActiveFromWhatsapp;
    const trialEligible =
      WHATSAPP_TRIAL_ENABLED &&
      (doc.whatsappTrialEligible === undefined || doc.whatsappTrialEligible === null
        ? !trialStarted
        : doc.whatsappTrialEligible);
    const trialPayload = {
      active: trialActiveFromWhatsapp,
      eligible: Boolean(trialEligible),
      started: trialStarted,
      expiresAt:
        WHATSAPP_TRIAL_ENABLED && trialActiveFromWhatsapp && trialExpiresAt
          ? trialExpiresAt.toISOString()
          : null,
    };

    // Já vinculado
    if (doc.whatsappVerified === true && doc.whatsappPhone) {
      return NextResponse.json(
        { linked: true, phone: doc.whatsappPhone, trial: trialPayload },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Pendente com código
    if (doc.whatsappVerificationCode) {
      const expiresAt =
        doc.whatsappVerificationCodeExpiresAt instanceof Date
          ? doc.whatsappVerificationCodeExpiresAt.toISOString()
          : doc.whatsappVerificationCodeExpiresAt
          ? new Date(doc.whatsappVerificationCodeExpiresAt).toISOString()
          : null;
      return NextResponse.json(
        {
          linked: false,
          pending: true,
          code: doc.whatsappVerificationCode,
          expiresAt,
          trial: trialPayload,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Não vinculado e sem código pendente
    return NextResponse.json(
      { linked: false, pending: false, code: null, trial: trialPayload },
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
