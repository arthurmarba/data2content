import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { recordMessageFeedback } from "@/app/lib/chatTelemetry";
import { logger } from "@/app/lib/logger";
import ChatSessionModel from "@/app/models/ChatSession";
import ChatMessageLogModel from "@/app/models/ChatMessageLog";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id || null;

  try {
    const body = await req.json().catch(() => ({}));
    const { messageId, rating, reason, sessionId, reasonCode } = body || {};
    if (!rating || (rating !== "up" && rating !== "down")) {
      return NextResponse.json({ error: "rating inválido" }, { status: 400 });
    }
    const allowedCodes = ["generic", "wrong", "didnt_use_context", "hard_to_follow", "too_long", "too_short", "slow", "other"];
    const normalizedCode = typeof reasonCode === "string" ? reasonCode.trim().toLowerCase() : null;
    let finalReasonCode = normalizedCode && allowedCodes.includes(normalizedCode) ? normalizedCode : null;
    if (rating === "down" && !finalReasonCode && reason) {
      finalReasonCode = "other";
    }
    if (rating === "down" && !finalReasonCode) {
      return NextResponse.json({ error: "reasonCode é obrigatório quando rating=down" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId é obrigatório" }, { status: 400 });
    }

    // Validação: sessão pertence ao usuário
    const sessionDoc = await ChatSessionModel.findById(sessionId).lean();
    if (!sessionDoc || (userId && sessionDoc.userId.toString() !== userId)) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }

    // Validação: mensagem pertence à sessão
    if (messageId) {
      const msg = await ChatMessageLogModel.findOne({ messageId, sessionId }).lean();
      if (!msg) {
        return NextResponse.json({ error: "Mensagem não encontrada na sessão" }, { status: 404 });
      }
    }

    const reasonSafe = typeof reason === "string" ? reason.trim().slice(0, 120) : null;

    await recordMessageFeedback({
      sessionId: sessionId || null,
      messageId: messageId || null,
      rating,
      reason: reasonSafe,
      reasonCode: finalReasonCode,
      reasonDetail: reasonSafe,
      userId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[api/chat/feedback/message] failed", error);
    return NextResponse.json({ error: "Falha ao registrar feedback" }, { status: 500 });
  }
}
