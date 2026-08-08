import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { logger } from "@/app/lib/logger";
import notifyFreeMonthEnding from "@/cron/notifyFreeMonthEnding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
  initError = "QStash signing keys não configuradas.";
  logger.error(`[cron.notifyFreeMonthEnding:init] ${initError}`);
} else {
  receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });
}

const TAG = "[cron.notifyFreeMonthEnding]";

export async function POST(request: NextRequest) {
  if (!receiver) {
    logger.error(`${TAG} Receiver não inicializado: ${initError}`);
    return NextResponse.json({ error: initError ?? "Receiver not initialised" }, { status: 500 });
  }

  try {
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      logger.error(`${TAG} Header 'upstash-signature' ausente.`);
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const body = await request.text();
    const valid = await receiver.verify({ signature, body });
    if (!valid) {
      logger.error(`${TAG} Assinatura inválida recebida.`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    logger.info(`${TAG} Assinatura verificada. Procurando meses grátis a vencer.`);
    const result = await notifyFreeMonthEnding();
    logger.info(`${TAG} Rotina concluída.`, result as unknown as Record<string, unknown>);

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Erro ao executar cron.`, error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
