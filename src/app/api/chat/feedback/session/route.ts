import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { recordSessionFeedback, closeChatSession } from "@/app/lib/chatTelemetry";
import { logger } from "@/app/lib/logger";
import ChatSessionModel from "@/app/models/ChatSession";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id || null;

  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, csat, comment, reasonCodes } = body || {};
    const score = Number(csat);
    if (!sessionId || Number.isNaN(score) || score < 1 || score > 5) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const allowedCodes = ["generic", "wrong", "didnt_use_context", "hard_to_follow", "too_long", "too_short", "slow", "other"];
    const reasons = Array.isArray(reasonCodes)
      ? Array.from(new Set(reasonCodes.map((r: any) => String(r || "").trim().toLowerCase()).filter((r: string) => allowedCodes.includes(r))))
      : [];
    if (score <= 3 && reasons.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um motivo para notas 1-3" }, { status: 400 });
    }
    const sessionDoc = await ChatSessionModel.findById(sessionId).lean();
    if (!sessionDoc || (userId && sessionDoc.userId.toString() !== userId)) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }
    await recordSessionFeedback({
      sessionId,
      csat: score,
      comment: typeof comment === "string" ? comment.slice(0, 400) : null,
      userId,
      endReason: 'user_feedback',
      reasons: reasons.length ? reasons : null,
    });
    await closeChatSession({ sessionId, reason: 'user_feedback' });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[api/chat/feedback/session] failed", error);
    return NextResponse.json({ error: "Falha ao registrar CSAT" }, { status: 500 });
  }
}
