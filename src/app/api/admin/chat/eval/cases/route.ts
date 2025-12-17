import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ChatEvalCaseModel from "@/app/models/ChatEvalCase";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 500);
  const cases = await ChatEvalCaseModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  return NextResponse.json({ cases });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.userPrompt || !body.rubric) {
    return NextResponse.json({ error: "userPrompt e rubric são obrigatórios" }, { status: 400 });
  }
  await connectToDatabase();
  const created = await ChatEvalCaseModel.create({
    userPrompt: body.userPrompt,
    surveySnapshot: body.surveySnapshot || null,
    contextNotes: body.contextNotes || null,
    intentHint: body.intentHint || null,
    fallbackCategory: body.fallbackCategory || null,
    category: body.category || null,
    rubric: body.rubric,
    tags: Array.isArray(body.tags) ? body.tags : [],
  });
  return NextResponse.json({ case: created });
}
