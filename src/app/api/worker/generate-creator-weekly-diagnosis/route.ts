import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { ensureWeeklyDiagnosis } from "@/app/lib/creatorWeeklyReport/diagnosisService";
import { isCreatorWeeklyDiagnosisEnabled } from "@/app/lib/creatorWeeklyReport/diagnosisFlag";

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
  if (!isCreatorWeeklyDiagnosisEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }
  if (!(await authorized(request))) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const weekKey = typeof body?.weekKey === "string" ? body.weekKey : null;
  if (!userId || !weekKey) {
    return NextResponse.json({ message: "userId e weekKey obrigatórios." }, { status: 400 });
  }

  try {
    const result = await ensureWeeklyDiagnosis({ userId, weekKey });
    // Falha de escrita não volta como erro: a própria trava agenda a nova
    // tentativa, e a retentativa da fila só repetiria a mesma chamada paga.
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[generate-creator-weekly-diagnosis] Falha ao escrever diagnóstico:", error);
    return NextResponse.json({ ok: false, safeErrorCode: "weekly_diagnosis_failed" }, { status: 500 });
  }
}
