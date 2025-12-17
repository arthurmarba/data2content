import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ChatSessionModel from "@/app/models/ChatSession";
import ChatSessionFeedbackModel from "@/app/models/ChatSessionFeedback";
import ChatMessageLogModel from "@/app/models/ChatMessageLog";
import ChatMessageFeedbackModel from "@/app/models/ChatMessageFeedback";
import ChatSessionReviewModel from "@/app/models/ChatSessionReview";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role || "";
  if (role.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const days = Math.min(Number(url.searchParams.get("days")) || 7, 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  await connectToDatabase();
  const sessions = await ChatSessionModel.find({
    startedAt: { $gte: since },
  })
    .sort({ startedAt: -1 })
    .limit(limit * 3)
    .lean();

  const sessionIds = sessions.map((s) => s._id);
  const feedbacks = await ChatSessionFeedbackModel.find({ sessionId: { $in: sessionIds } }).lean();
  const fbBySession = new Map<string, any>();
  feedbacks.forEach((f) => fbBySession.set(f.sessionId.toString(), f));

  const fallbacks = await ChatMessageLogModel.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    {
      $group: {
        _id: "$sessionId",
        fallbackCount: { $sum: { $cond: [{ $eq: ["$hadFallback", true] }, 1, 0] } },
        lowConfidence: { $sum: { $cond: [{ $lt: ["$confidence", 0.4] }, 1, 0] } },
      },
    },
  ]);
  const fbCount = new Map<string, { fallback: number; lowConf: number }>();
  fallbacks.forEach((f) => fbCount.set(String(f._id), { fallback: f.fallbackCount, lowConf: f.lowConfidence }));

  const thumbs = await ChatMessageFeedbackModel.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    {
      $group: {
        _id: "$sessionId",
        down: { $sum: { $cond: [{ $eq: ["$rating", "down"] }, 1, 0] } },
        up: { $sum: { $cond: [{ $eq: ["$rating", "up"] }, 1, 0] } },
      },
    },
  ]);
  const thumbsMap = new Map<string, { up: number; down: number }>();
  thumbs.forEach((t) => thumbsMap.set(String(t._id), { up: t.up, down: t.down }));

  const reviews = await ChatSessionReviewModel.find({ sessionId: { $in: sessionIds } }).lean();
  const reviewMap = new Map<string, any>();
  reviews.forEach((r) => reviewMap.set(r.sessionId.toString(), r));

  const queue = [];
  for (const s of sessions) {
    const sid = s._id.toString();
    const fb = fbBySession.get(sid);
    const agg = fbCount.get(sid) || { fallback: 0, lowConf: 0 };
    const th = thumbsMap.get(sid) || { up: 0, down: 0 };
    const review = reviewMap.get(sid);
    const breakdown = {
      csat: fb?.csat ? (fb.csat <= 2 ? 6 : fb.csat <= 3 ? 4 : 0) : 2,
      fallback: agg.fallback * 2,
      lowConfidence: agg.lowConf,
      thumbsDown: th.down * 2,
    };
    const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
    queue.push({
      id: sid,
      startedAt: s.startedAt,
      csat: fb?.csat ?? null,
      fallbackCount: agg.fallback,
      lowConfidenceCount: agg.lowConf,
      thumbsDown: th.down,
      score,
      scoreBreakdown: breakdown,
      reviewStatus: review?.status || "new",
      category: review?.category || null,
      severity: review?.severity || null,
      ticketUrl: review?.ticketUrl || null,
      reviewIsAuto: review?.isAuto || false,
      reviewAutoReason: review?.autoReason || null,
    });
  }
  queue.sort((a, b) => b.score - a.score);

  return NextResponse.json({ queue: queue.slice(0, limit) });
}
