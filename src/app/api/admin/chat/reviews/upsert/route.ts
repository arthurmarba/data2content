import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ChatSessionModel from "@/app/models/ChatSession";
import ChatSessionReviewModel from "@/app/models/ChatSessionReview";

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as any;
  const role = (session?.user as any)?.role || "";
  if (role.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { sessionId, category, severity, status, note, suggestedAction, ticketUrl } = body || {};
  if (!sessionId) return NextResponse.json({ error: "sessionId é obrigatório" }, { status: 400 });

  await connectToDatabase();
  const sessionDoc = await ChatSessionModel.findById(sessionId);
  if (!sessionDoc) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  const reviewer = (session?.user as any)?.id ? (session?.user as any)?.id : null;
  const payload: any = {
    sessionId,
    reviewerId: reviewer,
    reviewedBy: reviewer,
    isAuto: false,
    autoReason: null,
  };
  if (category !== undefined) payload.category = category || null;
  if (severity !== undefined) payload.severity = severity ?? null;
  if (status) payload.status = status;
  if (note !== undefined) payload.note = note || null;
  if (suggestedAction !== undefined) payload.suggestedAction = suggestedAction || null;
  if (ticketUrl !== undefined) payload.ticketUrl = ticketUrl || null;
  if (status === "fixed") payload.fixedAt = new Date();

  const review = await ChatSessionReviewModel.findOneAndUpdate(
    { sessionId },
    { $set: payload },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ review });
}
