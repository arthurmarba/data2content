import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import AIGeneratedPost from "@/app/models/AIGeneratedPost";

const SCRIPT_STRATEGIES = ["my_scripts_create", "my_scripts_adjust"] as const;

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function getIsoDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if ((session?.user as any)?.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectToDatabase();

  const doc = await AIGeneratedPost.findOne({
    _id: new Types.ObjectId(params.id),
    strategy: { $in: Array.from(SCRIPT_STRATEGIES) },
  })
    .select("title script strategy platform promptContext createdAt updatedAt")
    .lean()
    .exec();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const promptContext = getRecord(doc.promptContext) || {};

  return NextResponse.json({
    id: String(doc._id),
    createdAt: getIsoDate(doc.createdAt),
    updatedAt: getIsoDate(doc.updatedAt),
    title: getString(doc.title, "Sem título"),
    script: getString(doc.script),
    strategy: getString(doc.strategy, "unknown"),
    platform: getString(doc.platform, "instagram"),
    prompt: getString(promptContext.prompt),
    source: getString(promptContext.source, "unknown"),
    requestId: getString(promptContext.requestId) || null,
    scriptId: getString(promptContext.scriptId) || null,
    intelligenceSkippedForPartialAdjust: promptContext.intelligenceSkippedForPartialAdjust === true,
    diagnostics: getRecord(promptContext.diagnostics),
    intelligence: getRecord(promptContext.intelligence),
    adminRecommendation: getRecord(promptContext.adminRecommendation),
  });
}
