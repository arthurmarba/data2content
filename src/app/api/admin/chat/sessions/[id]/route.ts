import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ChatSessionModel from "@/app/models/ChatSession";
import ChatSessionFeedbackModel from "@/app/models/ChatSessionFeedback";
import ChatMessageLogModel from "@/app/models/ChatMessageLog";
import ChatMessageFeedbackModel from "@/app/models/ChatMessageFeedback";
import ChatSessionReviewModel from "@/app/models/ChatSessionReview";

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const session = (await getServerSession(authOptions)) as any;
  if ((session?.user as any)?.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const sessionDoc = await ChatSessionModel.findById(params.id).lean();
  if (!sessionDoc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const feedback = await ChatSessionFeedbackModel.findOne({ sessionId: sessionDoc._id }).lean();
  const logs = await ChatMessageLogModel.find({ sessionId: sessionDoc._id }).sort({ createdAt: 1 }).lean();
  const feedbacks = await ChatMessageFeedbackModel.find({ sessionId: sessionDoc._id }).lean();
  const feedbackMap = new Map<string, string>();
  feedbacks.forEach((f) => {
    if (f.messageId) feedbackMap.set(f.messageId, f.rating);
  });
  const review = await ChatSessionReviewModel.findOne({ sessionId: sessionDoc._id }).lean();

  const messages = logs.map((m) => ({
    id: m.messageId || m._id.toString(),
    role: m.role,
    content: m.content,
    intent: m.intent || null,
    confidence: m.confidence || null,
    fallbackReason: m.fallbackReason || null,
    hadFallback: m.hadFallback || false,
    rating: feedbackMap.get(m.messageId || "") || null,
    contextSourcesUsed: m.contextSourcesUsed || [],
    promptVariant: m.promptVariant || null,
    modelVersion: m.modelVersion || null,
    createdAt: m.createdAt,
  }));

  return NextResponse.json({
    session: {
      id: sessionDoc._id.toString(),
      startedAt: sessionDoc.startedAt,
      endedAt: sessionDoc.endedAt,
      promptVariant: sessionDoc.promptVariant || null,
      experimentId: sessionDoc.experimentId || null,
      modelVersion: sessionDoc.modelVersion || null,
      ragEnabled: sessionDoc.ragEnabled ?? null,
      contextSourcesUsed: sessionDoc.contextSourcesUsed || [],
      csat: feedback?.csat ?? null,
      csatComment: feedback?.comment ?? null,
      review: review
        ? {
            status: review.status,
            category: review.category,
            severity: review.severity,
            note: review.note,
            suggestedAction: review.suggestedAction,
            ticketUrl: review.ticketUrl,
            fixedAt: review.fixedAt,
            isAuto: review.isAuto || false,
            autoReason: review.autoReason || null,
          }
        : null,
    },
    messages,
  });
}
