/**
 * POST /api/cron/batch-readings
 *
 * Envia leituras publicadas para a Batch API (metade do preço) e coleta os jobs
 * prontos. Uma execução faz as duas coisas: coleta primeiro — para devolver à fila o
 * que falhou antes de escolher novos itens — e só depois envia.
 *
 * Ligado por `GEMINI_BATCH_READINGS`: `off` (padrão), `backlog` (só posts com mais de
 * 3 dias) ou `on`. Com a chave em `off`, a rota só coleta o que já estiver aberto.
 *
 * Desenho e regras em docs/plano-lote-gemini.md.
 */
import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import { enviarLoteDeLeituras, coletarLotes, modoLote } from "@/app/lib/relatorio/batchReadings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TAG = "[Cron BatchReadings]";
const receiver = process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
  ? new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    })
  : null;

async function autorizado(request: NextRequest, body: string): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.CRON_SECRET && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (!receiver) return false;
  return receiver.verify({ signature: request.headers.get("upstash-signature") || "", body }).catch(() => false);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!(await autorizado(request, body))) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    // Coleta antes de enviar: item que falhou volta a ser candidato na mesma execução.
    const coleta = await coletarLotes();

    const agora = new Date();
    const assinantes = (await UserModel.find(
      {
        isInstagramConnected: true,
        instagramAccountId: { $nin: [null, ""] },
        instagramAccessToken: { $nin: [null, ""] },
        $or: [
          { planStatus: "active", $or: [{ cancelAtPeriodEnd: { $ne: true } }, { currentPeriodEnd: { $gt: agora } }] },
          { planStatus: "non_renewing", currentPeriodEnd: { $gt: agora } },
        ],
      },
      { _id: 1 },
    ).lean().exec()) as unknown as Array<{ _id: Types.ObjectId }>;

    const envio = await enviarLoteDeLeituras(assinantes.map(user => user._id));
    const resultado = { modo: modoLote(), assinantes: assinantes.length, coleta, envio };
    logger.info(`${TAG} ${JSON.stringify(resultado)}`);
    return NextResponse.json(resultado);
  } catch (error) {
    logger.error(`${TAG} falhou.`, error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Erro." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Leitura publicada em lote (Batch API).",
    modo: modoLote(),
    modelo: process.env.GEMINI_CENA_MODEL || "gemini-2.5-flash",
  });
}
