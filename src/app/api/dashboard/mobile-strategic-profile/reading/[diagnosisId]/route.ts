import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { getCreatorVideoNarrativeDiagnosisForUser } from "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisReadService";
import { appendConfirmationQuizAnswer } from "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisService";

type RouteContext = { params: { diagnosisId: string } };

export async function PATCH(
  req: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await getServerSession(await resolveAuthOptions());
  const userId = (session as any)?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { diagnosisId } = params;
  if (!diagnosisId?.trim()) {
    return NextResponse.json({ error: "invalid_diagnosis_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const answer = (body as any)?.answer;
  if (
    !answer ||
    typeof answer.questionId !== "string" || !answer.questionId.trim() ||
    typeof answer.questionText !== "string" || !answer.questionText.trim() ||
    typeof answer.answerId !== "string" || !answer.answerId.trim() ||
    typeof answer.answerValue !== "string" || !answer.answerValue.trim()
  ) {
    return NextResponse.json({ error: "invalid_answer" }, { status: 400 });
  }

  try {
    const result = await appendConfirmationQuizAnswer({
      userId,
      diagnosisId: diagnosisId.trim(),
      answer: {
        questionId: answer.questionId.trim().slice(0, 100),
        questionText: answer.questionText.trim().slice(0, 300),
        answerId: answer.answerId.trim().slice(0, 100),
        answerValue: answer.answerValue.trim().slice(0, 300),
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reading-patch] erro ao salvar resposta:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await getServerSession(await resolveAuthOptions());
  const userId = (session as any)?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { diagnosisId } = params;
  if (!diagnosisId?.trim()) {
    return NextResponse.json({ error: "invalid_diagnosis_id" }, { status: 400 });
  }

  try {
    const reading = await getCreatorVideoNarrativeDiagnosisForUser({
      userId,
      diagnosisId: diagnosisId.trim(),
    });

    if (!reading) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      diagnosisId: reading.diagnosisId,
      rememberedAs: reading.videoReading.rememberedAs,
      createdAt: reading.analyzedAt ?? reading.createdAt ?? null,
      videoReading: reading.videoReading,
      speechReading: reading.speechReading,
      productionReading: reading.productionReading,
      commercialReading: reading.commercialReading,
      strategicRecommendation: reading.strategicRecommendation,
      profileContribution: reading.profileContribution,
      evidenceAnchors: reading.evidenceAnchors ?? null,
      narrativeCoherence: reading.narrativeCoherence ?? null,
    });
  } catch (err) {
    console.error("[reading-detail] erro ao buscar leitura:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
