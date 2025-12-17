import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ChatSessionModel from "@/app/models/ChatSession";
import ChatSessionFeedbackModel from "@/app/models/ChatSessionFeedback";
import ChatMessageLogModel from "@/app/models/ChatMessageLog";
import ChatMessageFeedbackModel from "@/app/models/ChatMessageFeedback";

function parseDateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const parsedFrom = from ? new Date(from) : null;
  const parsedTo = to ? new Date(to) : null;
  return {
    from: parsedFrom && !isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
    to: parsedTo && !isNaN(parsedTo.getTime()) ? parsedTo : undefined,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const range = parseDateRange(searchParams);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
  const filterBad = searchParams.get("filter") === "bad";

  await connectToDatabase();

  const match: Record<string, any> = {};
  if (range.from || range.to) {
    match.startedAt = {};
    if (range.from) match.startedAt.$gte = range.from;
    if (range.to) match.startedAt.$lte = range.to;
  }

  const sessions = await ChatSessionModel.find(match)
    .sort({ startedAt: -1 })
    .limit(limit * 3) // fetch extra for filtering bad
    .lean();

  const sessionIds = sessions.map((s) => s._id);
  const feedbacks = await ChatSessionFeedbackModel.find({ sessionId: { $in: sessionIds } }).lean();
  const feedbackBySession = new Map<string, any>();
  feedbacks.forEach((f) => feedbackBySession.set(f.sessionId.toString(), f));

  const logsAgg = await ChatMessageLogModel.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    {
      $group: {
        _id: "$sessionId",
        fallbackCount: { $sum: { $cond: [{ $eq: ["$hadFallback", true] }, 1, 0] } },
      },
    },
  ]);
  const fallbackBySession = new Map<string, number>();
  logsAgg.forEach((l) => fallbackBySession.set(String(l._id), l.fallbackCount));

  const thumbsAgg = await ChatMessageFeedbackModel.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    {
      $group: {
        _id: "$sessionId",
        down: { $sum: { $cond: [{ $eq: ["$rating", "down"] }, 1, 0] } },
        up: { $sum: { $cond: [{ $eq: ["$rating", "up"] }, 1, 0] } },
      },
    },
  ]);
  const thumbsBySession = new Map<string, { up: number; down: number }>();
  thumbsAgg.forEach((t) => thumbsBySession.set(String(t._id), { up: t.up, down: t.down }));

  const result = [];
  for (const s of sessions) {
    const sid = s._id.toString();
    const fb = feedbackBySession.get(sid);
    const fallbackCount = fallbackBySession.get(sid) || 0;
    const thumbs = thumbsBySession.get(sid) || { up: 0, down: 0 };
    const durationMs = (s.endedAt ? new Date(s.endedAt).getTime() : Date.now()) - new Date(s.startedAt).getTime();
    const isBad = (fb?.csat && fb.csat <= 3) || fallbackCount > 0 || thumbs.down > 0;
    if (filterBad && !isBad) continue;
    result.push({
      id: sid,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMs,
      csat: fb?.csat ?? null,
      csatComment: fb?.comment ?? null,
      fallbackCount,
      thumbsDown: thumbs.down,
      thumbsUp: thumbs.up,
      promptVariant: s.promptVariant || null,
      experimentId: s.experimentId || null,
      modelVersion: s.modelVersion || null,
      ragEnabled: s.ragEnabled ?? null,
      contextSourcesUsed: s.contextSourcesUsed || [],
    });
    if (result.length >= limit) break;
  }

  return NextResponse.json({ sessions: result });
}
