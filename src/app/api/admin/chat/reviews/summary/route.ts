import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ChatSessionReviewModel from "@/app/models/ChatSessionReview";
import ChatSessionFeedbackModel from "@/app/models/ChatSessionFeedback";
import ChatMessageFeedbackModel from "@/app/models/ChatMessageFeedback";

export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await connectToDatabase();

  const reviews = await ChatSessionReviewModel.find({}).lean();
  const sessionIds = reviews.map((r) => r.sessionId);
  const csats = await ChatSessionFeedbackModel.find({ sessionId: { $in: sessionIds } }).lean();
  const csatMap = new Map<string, number>();
  csats.forEach((c) => csatMap.set(c.sessionId.toString(), c.csat));

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
  const thumbMap = new Map<string, { down: number; up: number }>();
  thumbs.forEach((t) => thumbMap.set(String(t._id), { down: t.down, up: t.up }));

  const agg: Record<string, any> = {};
  reviews.forEach((r) => {
    const cat = r.category || "uncategorized";
    if (!agg[cat]) {
      agg[cat] = { count: 0, csatSum: 0, csatCount: 0, thumbsDown: 0, thumbsUp: 0, fixed: 0, tickets: 0, auto: 0, manual: 0 };
    }
    agg[cat].count += 1;
    if (r.isAuto) agg[cat].auto += 1;
    else agg[cat].manual += 1;
    const csatVal = csatMap.get(r.sessionId.toString());
    if (typeof csatVal === "number") {
      agg[cat].csatSum += csatVal;
      agg[cat].csatCount += 1;
    }
    const th = thumbMap.get(r.sessionId.toString());
    if (th) {
      agg[cat].thumbsDown += th.down;
      agg[cat].thumbsUp += th.up;
    }
    if (r.status === "fixed") agg[cat].fixed += 1;
    if (r.ticketUrl) agg[cat].tickets += 1;
  });

  const categories = Object.entries(agg).map(([category, stats]) => ({
    category,
    count: stats.count,
    csatAvg: stats.csatCount ? stats.csatSum / stats.csatCount : null,
    thumbsDown: stats.thumbsDown,
    thumbsUp: stats.thumbsUp,
    fixed: stats.fixed,
    tickets: stats.tickets,
    auto: stats.auto,
    manual: stats.manual,
  }));

  return NextResponse.json({ categories });
}
