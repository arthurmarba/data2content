// src/app/api/whatsapp/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/whatsapp/verify
 * Body: { phoneNumber: string, code: string }
 * - Não depende de sessão/cookies (WhatsApp não envia cookies).
 * - Vincula o telefone e marca whatsappVerified=true; invalida o código.
 */
export async function POST(request: NextRequest) {
  try {
    logger.debug("[whatsapp/verify] ▶︎ Iniciando verificação de código (sem sessão).");

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
      "_id planStatus whatsappVerificationCode whatsappVerificationCodeExpiresAt whatsappVerified whatsappPhone whatsappLinkedAt whatsappTrialEligible whatsappTrialActive whatsappTrialStartedAt whatsappTrialExpiresAt"
    );
    if (!user) {
      logger.error("[whatsapp/verify] Código inválido ou expirado:", code);
      return NextResponse.json(
        { error: "Código inválido ou expirado." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    logger.debug(
      "[whatsapp/verify] Usuário encontrado:",
      String(user._id),
      "status:",
      user.planStatus
    );

    const now = new Date();
    const codeExpired =
      user.whatsappVerificationCodeExpiresAt instanceof Date &&
      user.whatsappVerificationCodeExpiresAt.getTime() < now.getTime();
    if (codeExpired) {
      logger.warn("[whatsapp/verify] Código expirado para user:", String(user._id));
      return NextResponse.json(
        { error: "Código expirado. Gere um novo e tente novamente." },
        { status: 410, headers: { "Cache-Control": "no-store" } }
      );
    }
    // 3) Atualiza atomically: define phone + verified, remove code
    const setPayload: Record<string, unknown> = {
      whatsappPhone: phoneNumber,
      whatsappVerified: true,
      whatsappLinkedAt: user.whatsappLinkedAt ?? now,
    };

    const updated = await User.findOneAndUpdate(
      { _id: user._id, whatsappVerificationCode: code },
      {
        $set: setPayload,
        $unset: { whatsappVerificationCode: "", whatsappVerificationCodeExpiresAt: "" },
      },
      { new: true }
    ).select(
      "_id whatsappPhone whatsappVerified whatsappTrialActive whatsappTrialStartedAt whatsappTrialExpiresAt whatsappLinkedAt"
    );

    if (!updated) {
      // Corrida: alguém pode ter verificado ao mesmo tempo
      logger.warn("[whatsapp/verify] Conflito ao salvar (provável corrida). user:", String(user._id));
      return NextResponse.json(
        {
          error:
            "Não foi possível concluir a verificação agora. Gere um novo código e tente novamente.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    logger.info(
      "[whatsapp/verify] ✅ Vinculação concluída. user:",
      String(updated._id),
      "phone:",
      updated.whatsappPhone
    );
    return NextResponse.json(
      {
        message: "Vinculação concluída com sucesso!",
        trial: {
          active: Boolean(updated.whatsappTrialActive),
          startedAt: updated.whatsappTrialStartedAt
            ? new Date(updated.whatsappTrialStartedAt).toISOString()
            : null,
          expiresAt: updated.whatsappTrialExpiresAt
            ? new Date(updated.whatsappTrialExpiresAt).toISOString()
            : null,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    logger.error("[whatsapp/verify] Erro geral:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Falha ao verificar código: ${errorMessage}` },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
