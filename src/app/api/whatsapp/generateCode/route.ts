// src/app/api/whatsapp/generateCode/route.ts
import { NextRequest, NextResponse } from "next/server";
import { guardPremiumRequest } from "@/app/lib/planGuard";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { connectToDatabase } from "@/app/lib/mongoose";
import mongoose from "mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";

/** Gera um código de verificação aleatório com 6 caracteres maiúsculos. */
function generateVerificationCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Extrai userId do request (token -> cookie fallback) aceitando id OU sub. */
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // 1) next-auth
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (token && !(token as any).id && (token as any).sub) {
      (token as any).id = String((token as any).sub);
    }
    const uid = (token as any)?.id;
    if (uid) return String(uid);
    console.log("[whatsapp/generateCode] getToken() -> OK mas sem id");
  } catch (e) {
    console.error("[whatsapp/generateCode] getToken() error:", e);
  }

  // 2) cookie fallback
  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";
  const raw = request.cookies.get(cookieName)?.value;
  console.log(`[whatsapp/generateCode] manual cookie ${cookieName}:`, raw ? "FOUND" : "MISSING");
  if (!raw) return null;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[whatsapp/generateCode] NEXTAUTH_SECRET ausente");
    return null;
  }
  try {
    const decoded = await jwtVerify(raw, new TextEncoder().encode(secret));
    const payload = decoded?.payload as any;
    const uid = payload?.id ?? payload?.sub;
    if (uid) {
      console.log("[whatsapp/generateCode] manual jwtVerify() -> OK (payload only)");
      return String(uid);
    }
  } catch (err) {
    console.error("[whatsapp/generateCode] manual jwtVerify() error:", err);
  }
  return null;
}

export async function POST(request: NextRequest) {
  // Bloqueia quem não tem plano ativo (active | non_renewing | trial).
  // IMPORTANTE: garantir no planGuard.ts que 'trial' está incluído como ativo.
  const guardResponse = await guardPremiumRequest(request);
  if (guardResponse) return guardResponse;

  console.log("[whatsapp/generateCode] ▶︎ Request received");

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.warn("[whatsapp/generateCode] Auth falhou (sem userId).");
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!mongoose.isValidObjectId(userId)) {
      console.warn(`[whatsapp/generateCode] userId inválido (não ObjectId): ${userId}`);
      return NextResponse.json(
        { error: "ID de usuário inválido." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2) DB
    await connectToDatabase();
    console.log("[whatsapp/generateCode] DB connected. dbName =", mongoose.connection.name);

    // 3) Já vinculado? NÃO gera código e não altera nada
    const current = await User.findById(userId).select(
      "_id whatsappVerificationCode whatsappPhone whatsappVerified"
    );
    if (!current) {
      console.warn(`[whatsapp/generateCode] Usuário ${userId} não encontrado`);
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const isLinked = !!current.whatsappPhone && current.whatsappVerified === true;
    if (isLinked) {
      console.log(
        `[whatsapp/generateCode] User already linked -> user=${current._id}, phone=${current.whatsappPhone}`
      );
      return NextResponse.json(
        { linked: true, phone: current.whatsappPhone },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 4) Se já existe um código pendente, apenas retorne-o (idempotente)
    if (current.whatsappVerificationCode) {
      console.log(
        `[whatsapp/generateCode] Pending existing code -> user=${current._id}, code=${current.whatsappVerificationCode}`
      );
      return NextResponse.json(
        { code: current.whatsappVerificationCode },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 5) Não vinculado e sem código pendente -> gerar e salvar um novo código
    //    **IMPORTANTE**: não mexer em whatsappPhone nem em whatsappVerified aqui.
    const freshCode = generateVerificationCode();

    const updated = await User.findOneAndUpdate(
      {
        _id: userId,
        // Garante que não vamos sobrescrever caso alguém tenha verificado no meio tempo
        whatsappVerified: { $ne: true },
        $or: [
          { whatsappVerificationCode: { $exists: false } },
          { whatsappVerificationCode: null },
          { whatsappVerificationCode: "" },
        ],
      },
      { $set: { whatsappVerificationCode: freshCode } },
      { new: true }
    ).select("_id whatsappVerificationCode whatsappPhone whatsappVerified");

    if (!updated) {
      // Em corrida de requests, se não atualizou, recarrega e decide:
      const doc = await User.findById(userId).select(
        "_id whatsappVerificationCode whatsappPhone whatsappVerified"
      );

      if (!doc) {
        return NextResponse.json(
          { error: "Usuário não encontrado." },
          { status: 404, headers: { "Cache-Control": "no-store" } }
        );
      }
      const nowLinked = !!doc.whatsappPhone && doc.whatsappVerified === true;
      if (nowLinked) {
        return NextResponse.json(
          { linked: true, phone: doc.whatsappPhone },
          { status: 200, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (doc.whatsappVerificationCode) {
        return NextResponse.json(
          { code: doc.whatsappVerificationCode },
          { status: 200, headers: { "Cache-Control": "no-store" } }
        );
      }
      // Caso raro: segue sem ação
      return NextResponse.json(
        {
          linked: false,
          message:
            "Nenhuma ação necessária (verificação pode ter sido concluída em paralelo ou não há pendências).",
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.log(
      `[whatsapp/generateCode] Generated new code -> user=${updated._id}, code=${updated.whatsappVerificationCode}, phone=${updated.whatsappPhone}, verified=${updated.whatsappVerified}`
    );

    return NextResponse.json(
      { code: updated.whatsappVerificationCode },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[whatsapp/generateCode] Erro geral:", err);
    return NextResponse.json(
      { error: "Falha ao gerar código." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
