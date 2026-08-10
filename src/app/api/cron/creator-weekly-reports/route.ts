import { NextRequest, NextResponse } from "next/server";
import { Client as QStashClient, Receiver } from "@upstash/qstash";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { generateCreatorWeeklyReport } from "@/app/lib/creatorWeeklyReport/service";
import { isCreatorWeeklyProfileExperienceEnabled } from "@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const receiver = process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
  ? new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    })
  : null;

const qstash = process.env.QSTASH_TOKEN
  ? new QStashClient({ token: process.env.QSTASH_TOKEN })
  : null;
const workerUrl = `${
  process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL
}/api/worker/generate-creator-weekly-report`;

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

  await connectToDatabase();
  const users = await User.find({
    isInstagramConnected: true,
    planStatus: { $in: ["active", "non_renewing"] },
  })
    .select("_id")
    .lean<Array<{ _id: { toString(): string } }>>();

  if (!qstash || !workerUrl.startsWith("http")) {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ message: "Fila semanal não configurada." }, { status: 500 });
    }

    let generated = 0;
    let failed = 0;
    for (const user of users) {
      try {
        await generateCreatorWeeklyReport({ userId: user._id.toString(), force: true });
        generated += 1;
      } catch (error) {
        failed += 1;
        console.error("[creator-weekly-reports] Falha local ao gerar relatório:", error);
      }
    }
    return NextResponse.json({ ok: true, mode: "local", eligible: users.length, generated, failed });
  }

  let queued = 0;
  let failed = 0;
  for (const user of users) {
    try {
      await qstash.publishJSON({
        url: workerUrl,
        body: { userId: user._id.toString() },
        retries: 2,
      });
      queued += 1;
    } catch (error) {
      failed += 1;
      console.error("[creator-weekly-reports] Falha ao enfileirar relatório:", error);
    }
  }

  return NextResponse.json({ ok: true, mode: "queue", eligible: users.length, queued, failed });
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
  }
  return POST(request);
}
