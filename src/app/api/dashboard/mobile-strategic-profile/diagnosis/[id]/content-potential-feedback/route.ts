import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";

const TARGETS = new Set(["overall", "evidence", "direction"]);
const VALUES = new Set(["helpful", "not_in_video", "wrong_intent"]);
const MOMENTS = new Set(["opening", "development", "closing"]);

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
  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  if (!params.id || typeof params.id !== "string") {
    return NextResponse.json({ message: "ID inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const target = typeof body?.target === "string" ? body.target : "";
  const value = typeof body?.value === "string" ? body.value : "";
  const moment = typeof body?.moment === "string" ? body.moment : undefined;
  if (!TARGETS.has(target) || !VALUES.has(value) || (moment && !MOMENTS.has(moment))) {
    return NextResponse.json({ message: "Feedback inválido." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const { default: CreatorVideoNarrativeDiagnosis } = await import(
      "@/app/models/CreatorVideoNarrativeDiagnosis"
    );
    const diagnosis = await CreatorVideoNarrativeDiagnosis.findOneAndUpdate(
      { diagnosisId: params.id, userId: new Types.ObjectId(userId) },
      {
        $push: {
          contentPotentialFeedback: {
            $each: [{ target, value, ...(moment ? { moment } : {}), createdAt: new Date() }],
            $slice: -20,
          },
        },
      },
      { new: true },
    ).lean();

    if (!diagnosis) {
      return NextResponse.json({ message: "Diagnóstico não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[content-potential-feedback] Erro:", error);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
