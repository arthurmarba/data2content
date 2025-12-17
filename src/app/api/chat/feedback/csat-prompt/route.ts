import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { markCsatPrompted } from "@/app/lib/chatTelemetry";
import ChatSessionModel from "@/app/models/ChatSession";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id || null;

  const body = await req.json().catch(() => ({}));
  const { sessionId } = body || {};
  if (!sessionId) return NextResponse.json({ error: "sessionId é obrigatório" }, { status: 400 });

  const sessionDoc = await ChatSessionModel.findById(sessionId).lean();
  if (!sessionDoc || (userId && sessionDoc.userId.toString() !== userId)) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  await markCsatPrompted(sessionId);
  return NextResponse.json({ ok: true });
}
