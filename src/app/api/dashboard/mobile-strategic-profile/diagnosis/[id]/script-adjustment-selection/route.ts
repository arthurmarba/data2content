import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { sanitizeScriptAdjustmentRecommendation } from "@/app/dashboard/boards/videoUpload/scriptAdjustmentRecommendation";

function methodNotAllowed() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export const GET = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }
  const session = await getServerSession(await resolveAuthOptions());
  const userId: string | undefined = (session as any)?.user?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  const diagnosisId = (await params).id?.trim();
  const body = await request.json().catch(() => null);
  const selectedStepIds: string[] | null = Array.isArray(body?.selectedStepIds)
    ? [...new Set<string>(body.selectedStepIds
        .filter((value: unknown): value is string => typeof value === "string")
        .map((value: string) => value.trim().slice(0, 60))
        .filter(Boolean))].slice(0, 6)
    : null;
  if (!diagnosisId || selectedStepIds === null) {
    return NextResponse.json({ message: "Seleção inválida." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const { default: Diagnosis } = await import("@/app/models/CreatorVideoNarrativeDiagnosis");
    const diagnosis = await Diagnosis.findOne({
      diagnosisId,
      userId: new Types.ObjectId(userId),
    }).select("scriptAdjustmentRecommendation videoMetadata.durationSeconds").lean();
    if (!diagnosis) return NextResponse.json({ message: "Diagnóstico não encontrado." }, { status: 404 });
    const recommendation = sanitizeScriptAdjustmentRecommendation(
      (diagnosis as any).scriptAdjustmentRecommendation,
      { durationSeconds: (diagnosis as any).videoMetadata?.durationSeconds },
    );
    if (!recommendation) return NextResponse.json({ message: "Ajuste não pertence a esta análise." }, { status: 409 });
    const allowed = new Set(recommendation.steps.map((step) => step.id));
    if (selectedStepIds.some((id) => !allowed.has(id))) {
      return NextResponse.json({ message: "Um passo não pertence a esta análise." }, { status: 409 });
    }
    await Diagnosis.updateOne(
      { diagnosisId, userId: new Types.ObjectId(userId) },
      {
        $set: {
          scriptAdjustmentSelection: {
            selectedStepIds,
            recommendationVersion: recommendation.version,
            selectedAt: new Date(),
          },
        },
      },
    );
    return NextResponse.json({ ok: true, selectedSteps: selectedStepIds.length });
  } catch (error) {
    console.error("[script-adjustment-selection] Erro:", error);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
