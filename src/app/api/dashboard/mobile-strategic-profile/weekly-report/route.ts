import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import {
  generateCreatorWeeklyReport,
  getOrGenerateCreatorWeeklyReport,
} from "@/app/lib/creatorWeeklyReport/service";
import { isCreatorWeeklyProfileExperienceEnabled } from "@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authenticatedUserId(): Promise<string | null> {
  const session = await getServerSession(await resolveAuthOptions()) as {
    user?: { id?: string };
  } | null;
  return session?.user?.id ?? null;
}

export async function GET() {
  if (!isCreatorWeeklyProfileExperienceEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  try {
    const snapshot = await getOrGenerateCreatorWeeklyReport(userId);
    return NextResponse.json({ ok: true, report: snapshot.report });
  } catch (error) {
    console.error("[weekly-report] Falha ao carregar relatório:", error);
    return NextResponse.json(
      { ok: false, safeErrorCode: "weekly_report_unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isCreatorWeeklyProfileExperienceEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  try {
    const snapshot = await generateCreatorWeeklyReport({
      userId,
      force: body?.force === true,
    });
    return NextResponse.json({ ok: true, report: snapshot.report });
  } catch (error) {
    console.error("[weekly-report] Falha ao gerar relatório:", error);
    return NextResponse.json(
      { ok: false, safeErrorCode: "weekly_report_generation_failed" },
      { status: 503 },
    );
  }
}
