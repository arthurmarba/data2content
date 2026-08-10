import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { generateCreatorWeeklyReport } from "@/app/lib/creatorWeeklyReport/service";
import { isCreatorWeeklyProfileExperienceEnabled } from "@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const receiver = process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
  ? new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    })
  : null;

async function authorized(request: NextRequest): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.CRON_SECRET && request.headers.get("x-cron-key") === process.env.CRON_SECRET) return true;
  if (!receiver) return false;
  const signature = request.headers.get("upstash-signature") ?? "";
  const body = await request.clone().text();
  return receiver.verify({ signature, body }).catch(() => false);
}

export async function POST(request: NextRequest) {
  if (!isCreatorWeeklyProfileExperienceEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }
  if (!(await authorized(request))) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!userId) {
    return NextResponse.json({ message: "userId obrigatório." }, { status: 400 });
  }

  try {
    const snapshot = await generateCreatorWeeklyReport({ userId, force: true });
    return NextResponse.json({
      ok: true,
      weekKey: snapshot.report.weekKey,
      status: snapshot.report.status,
    });
  } catch (error) {
    console.error("[generate-creator-weekly-report] Falha ao gerar relatório:", error);
    return NextResponse.json(
      { ok: false, safeErrorCode: "weekly_report_generation_failed" },
      { status: 500 },
    );
  }
}
