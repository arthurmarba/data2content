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

export async function POST(request: NextRequest) {
  const guardResponse = await guardPremiumRequest(request);
  if (guardResponse) return guardResponse;

  console.log("[whatsapp/generateCode] ▶︎ Request received");

  try {
    // 1) Autenticação via next-auth; fallback decodificando cookie manualmente
    let token: any = null;
    try {
      token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      console.log("[whatsapp/generateCode] getToken() ->", token ? "OK" : "NULL");
    } catch (e) {
      console.error("[whatsapp/generateCode] getToken() error:", e);
    }

    if (!token) {
      const cookieName =
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token";
      const raw = request.cookies.get(cookieName)?.value;
      console.log(
        `[whatsapp/generateCode] manual cookie ${cookieName}:`,
        raw ? "FOUND" : "MISSING"
      );
      if (raw) {
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
          console.error("[whatsapp/generateCode] NEXTAUTH_SECRET ausente");
          return NextResponse.json(
            { error: "Configuração do servidor ausente." },
            { status: 500 }
          );
        }
        try {
          const decoded = await jwtVerify(raw, new TextEncoder().encode(secret));
          token = decoded.payload;
          console.log("[whatsapp/generateCode] manual jwtVerify() -> OK (payload only)");
        } catch (err) {
          console.error("[whatsapp/generateCode] manual jwtVerify() error:", err);
        }
      }
    }

    if (!token || !token.sub) {
      console.warn("[whatsapp/generateCode] Auth falhou (sem token/sub).");
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const userId = String(token.sub);
    if (!mongoose.isValidObjectId(userId)) {
      console.warn(`[whatsapp/generateCode] Token.sub inválido (não ObjectId): ${userId}`);
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
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
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const isLinked = !!current.whatsappPhone && current.whatsappVerified === true;
    if (isLinked) {
      console.log(
        `[whatsapp/generateCode] User already linked -> user=${current._id}, phone=${current.whatsappPhone}`
      );
      return NextResponse.json(
        { linked: true, phone: current.whatsappPhone },
        { status: 200 }
      );
    }

    // 4) Se já existe um código pendente, apenas retorne-o (idempotente)
    if (current.whatsappVerificationCode) {
      console.log(
        `[whatsapp/generateCode] Pending existing code -> user=${current._id}, code=${current.whatsappVerificationCode}`
      );
      return NextResponse.json({ code: current.whatsappVerificationCode }, { status: 200 });
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
      {
        $set: {
          whatsappVerificationCode: freshCode,
          // NÃO tocar em whatsappPhone nem em whatsappVerified aqui
        },
      },
      { new: true }
    ).select("_id whatsappVerificationCode whatsappPhone whatsappVerified");

    if (!updated) {
      // Em corrida de requests, se não atualizou, recarrega e decide:
      const doc = await User.findById(userId).select(
        "_id whatsappVerificationCode whatsappPhone whatsappVerified"
      );

      if (!doc) {
        return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
      }
      const nowLinked = !!doc.whatsappPhone && doc.whatsappVerified === true;
      if (nowLinked) {
        return NextResponse.json({ linked: true, phone: doc.whatsappPhone }, { status: 200 });
      }
      if (doc.whatsappVerificationCode) {
        return NextResponse.json({ code: doc.whatsappVerificationCode }, { status: 200 });
      }
      // Caso raro: segue sem ação
      return NextResponse.json(
        {
          linked: false,
          message:
            "Nenhuma ação necessária (verificação pode ter sido concluída em paralelo ou não há pendências).",
        },
        { status: 200 }
      );
    }

    console.log(
      `[whatsapp/generateCode] Generated new code -> user=${updated._id}, code=${updated.whatsappVerificationCode}, phone=${updated.whatsappPhone}, verified=${updated.whatsappVerified}`
    );

    return NextResponse.json({ code: updated.whatsappVerificationCode }, { status: 200 });
  } catch (err) {
    console.error("[whatsapp/generateCode] Erro geral:", err);
    return NextResponse.json({ error: "Falha ao gerar código." }, { status: 500 });
  }
}
