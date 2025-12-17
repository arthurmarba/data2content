import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { recordMessageFeedback } from "@/app/lib/chatTelemetry";
import { logger } from "@/app/lib/logger";
import ChatSessionModel from "@/app/models/ChatSession";
import ChatMessageLogModel from "@/app/models/ChatMessageLog";
import { FEEDBACK_REASON_CODES } from "@/app/lib/feedbackReasons";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id || null;

  try {
    const body = await req.json().catch(() => ({}));
    const { messageId, rating, reason, sessionId, reasonCode } = body || {};
    if (!rating || (rating !== "up" && rating !== "down")) {
      return NextResponse.json({ error: "rating inválido" }, { status: 400 });
    }
    const allowedCodes = FEEDBACK_REASON_CODES as readonly string[];
    const normalizedCode = typeof reasonCode === "string" ? reasonCode.trim().toLowerCase() : null;
    let finalReasonCode: (typeof FEEDBACK_REASON_CODES)[number] | null =
      normalizedCode && (allowedCodes as readonly string[]).includes(normalizedCode) ? (normalizedCode as any) : null;
    if (rating === "down" && !finalReasonCode && reason) {
      finalReasonCode = "other";
    }
    if (rating === "down" && !finalReasonCode) {
      return NextResponse.json({ error: "INVALID_REASON_CODE" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId é obrigatório" }, { status: 400 });
    }
    if (!messageId) {
      return NextResponse.json({ error: "MISSING_IDS" }, { status: 400 });
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

    const reasonSafe = typeof reason === "string" ? reason.trim().slice(0, 240) : null;
    if (rating === "down" && finalReasonCode === "other" && (!reasonSafe || reasonSafe.length < 5)) {
      return NextResponse.json({ error: "MISSING_REASON_DETAIL" }, { status: 400 });
    }

    await recordMessageFeedback({
      sessionId: sessionId || null,
      messageId: messageId || null,
      rating,
      reason: reasonSafe,
      reasonCode: finalReasonCode,
      reasonDetail: reasonSafe,
      userId,
    });
    return NextResponse.json({ ok: true, reasonCode: finalReasonCode });
  } catch (error) {
    logger.error("[api/chat/feedback/message] failed", error);
    return NextResponse.json({ error: "Falha ao registrar feedback" }, { status: 500 });
  }
}
