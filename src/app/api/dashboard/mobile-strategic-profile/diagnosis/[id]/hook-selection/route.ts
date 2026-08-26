import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { sanitizeHookRecommendation } from "@/app/dashboard/boards/videoUpload/hookRecommendation";

function methodNotAllowed() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export const GET = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }
  const session = await getServerSession(await resolveAuthOptions());
  const userId: string | undefined = (session as any)?.user?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  const diagnosisId = params.id?.trim();
  const body = await request.json().catch(() => null);
  const candidateId = typeof body?.candidateId === "string" ? body.candidateId.trim().slice(0, 80) : "";
  if (!diagnosisId || !candidateId) {
    return NextResponse.json({ message: "Seleção inválida." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const { default: Diagnosis } = await import("@/app/models/CreatorVideoNarrativeDiagnosis");
    const diagnosis = await Diagnosis.findOne({
      diagnosisId,
      userId: new Types.ObjectId(userId),
    }).select("hookRecommendation").lean();
    if (!diagnosis) {
      return NextResponse.json({ message: "Diagnóstico não encontrado." }, { status: 404 });
    }
    const recommendation = sanitizeHookRecommendation((diagnosis as any).hookRecommendation);
    const candidate = recommendation
      ? [recommendation.primary, ...recommendation.alternatives].find((item) => item.id === candidateId)
      : null;
    if (!candidate) {
      return NextResponse.json({ message: "Gancho não pertence a esta análise." }, { status: 409 });
    }

    await Diagnosis.updateOne(
      { diagnosisId, userId: new Types.ObjectId(userId) },
      { $set: { hookSelection: { candidateId, candidate, selectedAt: new Date() } } },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[hook-selection] Erro:", error);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
