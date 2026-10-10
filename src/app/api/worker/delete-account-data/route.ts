import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { deleteAccountData } from "@/app/lib/account/accountDataDeletion";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Apaga os dados de uma conta que já foi excluída. Nunca de uma conta que existe. */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return NextResponse.json({ error: "worker_not_configured" }, { status: 503 });
  const valid = await new Receiver({ currentSigningKey, nextSigningKey })
    .verify({ body, signature: request.headers.get("upstash-signature") || "" })
    .catch(() => false);
  if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let userId: unknown;
  try { userId = JSON.parse(body).userId; } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  if (typeof userId !== "string" || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  await connectToDatabase();
  if (await User.exists({ _id: userId })) {
    logger.warn("[account.delete][data_worker_refused_live_account]", { userId });
    return NextResponse.json({ error: "account_still_exists" }, { status: 409 });
  }

  try {
    const report = await deleteAccountData(userId);
    logger.info("[account.delete][data_deleted]", { userId, ...report });
    return NextResponse.json(report);
  } catch (error) {
    logger.error("[account.delete][data_worker_failed]", { userId, error: String(error) });
    return NextResponse.json({ error: "deletion_failed" }, { status: 503 });
  }
}
