// src/app/api/whatsapp/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isActiveLike(s: unknown): s is "active" | "non_renewing" | "trial" {
  return s === "active" || s === "non_renewing" || s === "trial";
}

/**
 * POST /api/whatsapp/verify
 * Body: { phoneNumber: string, code: string }
 * - Não depende de sessão/cookies (WhatsApp não envia cookies).
 * - Valida status do plano via DB (active | non_renewing | trial = OK).
 * - Vincula o telefone e marca whatsappVerified=true; invalida o código.
 */
export async function POST(request: NextRequest) {
  try {
    console.debug("[whatsapp/verify] ▶︎ Iniciando verificação de código (sem sessão).");

    await connectToDatabase();

    const body = await request.json();
    const phoneNumber = String(body?.phoneNumber || "").trim();
    const code = String(body?.code || "").trim().toUpperCase();

    if (!phoneNumber || !code) {
      console.error("[whatsapp/verify] Parâmetros ausentes.", { phoneNumber, code });
      return NextResponse.json(
        { error: "Parâmetros 'phoneNumber' e 'code' são obrigatórios." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 1) Busca usuário pelo código
    const user = await User.findOne({ whatsappVerificationCode: code }).select(
      "_id planStatus whatsappVerificationCode"
    );
    if (!user) {
      console.error("[whatsapp/verify] Código inválido ou expirado:", code);
      return NextResponse.json(
        { error: "Código inválido ou expirado." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.debug("[whatsapp/verify] Usuário encontrado:", String(user._id), "status:", user.planStatus);

    // 2) Checa plano ativo-like
    if (!isActiveLike(user.planStatus)) {
      console.error("[whatsapp/verify] Plano não ativo-like:", user.planStatus, "user:", String(user._id));
      return NextResponse.json(
        {
          error:
            "Seu plano não está ativo. Ative sua assinatura para vincular o WhatsApp.",
          status: user.planStatus,
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 3) Atualiza atomically: define phone + verified, remove code
    const updated = await User.findOneAndUpdate(
      { _id: user._id, whatsappVerificationCode: code },
      {
        $set: { whatsappPhone: phoneNumber, whatsappVerified: true },
        $unset: { whatsappVerificationCode: "" },
      },
      { new: true }
    ).select("_id whatsappPhone whatsappVerified");

    if (!updated) {
      // Corrida: alguém pode ter verificado ao mesmo tempo
      console.warn("[whatsapp/verify] Conflito ao salvar (provável corrida). user:", String(user._id));
      return NextResponse.json(
        {
          error:
            "Não foi possível concluir a verificação agora. Gere um novo código e tente novamente.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.debug(
      "[whatsapp/verify] ✅ Vinculação concluída. user:",
      String(updated._id),
      "phone:",
      updated.whatsappPhone
    );
    return NextResponse.json(
      { message: "Vinculação concluída com sucesso!" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[whatsapp/verify] Erro geral:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Falha ao verificar código: ${errorMessage}` },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
