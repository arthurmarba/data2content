import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  isValidAdaptivePlanBody,
  normalizeAdaptivePlanBody,
} from "@/app/api/post-creation/adaptive/payload";
import { validatePostCreationAdaptiveServerAccess } from "@/app/api/post-creation/adaptive/access";
import { validatePostCreationBoardAccess } from "@/app/lib/postCreationTrial/access";
import { resolveTargetScriptsUser } from "@/app/lib/scripts/access";
import { buildPostCreationStrategicPlan } from "@/app/dashboard/boards/postCreationAdaptivePlanBuilder";
import { buildPostCreationLegacyHandoff } from "@/app/dashboard/boards/postCreationAdaptiveLegacyAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedSession() {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = session?.user?.id;
  if (typeof userId !== "string" || !userId.trim()) return null;
  return session;
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await validatePostCreationBoardAccess({ request, session: session as any });
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, reason: access.reason }, { status: access.status });
  }

  const adaptiveAccess = validatePostCreationAdaptiveServerAccess({ session });
  if (!adaptiveAccess.ok) {
    return NextResponse.json(
      { ok: false, error: adaptiveAccess.error, reason: adaptiveAccess.reason },
      { status: adaptiveAccess.status }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const normalized = normalizeAdaptivePlanBody(body);
  if (!isValidAdaptivePlanBody(normalized) || !normalized.detection) {
    return NextResponse.json(
      { ok: false, error: "Não foi possível gerar o plano com as respostas enviadas." },
      { status: 400 }
    );
  }

  const targetResolution = resolveTargetScriptsUser({
    session: session as any,
    targetUserId: normalized.targetUserId,
  });
  if (!targetResolution.ok) {
    return NextResponse.json({ ok: false, error: targetResolution.error }, { status: targetResolution.status });
  }

  const plan = buildPostCreationStrategicPlan({
    detection: normalized.detection,
    questions: normalized.questions,
    answers: normalized.answers,
  });
  const legacyHandoff = buildPostCreationLegacyHandoff({ plan });

  return NextResponse.json({
    ok: true,
    plan,
    legacyHandoff,
  });
}
