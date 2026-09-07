import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Types } from "mongoose";
import { maintainScriptEvidence } from "@/app/lib/scripts/scriptEvidenceMaintenance";
import { acquireReading, finishReading } from "@/app/lib/relatorio/contentReadingState";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  const body = await request.text();
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return NextResponse.json({ error: "worker_not_configured" }, { status: 503 });
  const valid = await new Receiver({ currentSigningKey, nextSigningKey }).verify({ body, signature: request.headers.get("upstash-signature") || "" }).catch(() => false);
  if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let userId: string;
  try { userId = JSON.parse(body).userId; } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  if (!Types.ObjectId.isValid(userId)) return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  const id = `dna:${userId}`;
  const lease = await acquireReading(id, `script_evidence_v2:${new Date().toISOString().slice(0,13)}`);
  if (!lease) return NextResponse.json({ deferred: true });
  try {
    const result = await maintainScriptEvidence(userId, false);
    await finishReading(id, lease.token);
    return NextResponse.json(result);
  } catch {
    await finishReading(id, lease.token, "Falha temporária de manutenção");
    return NextResponse.json({ error: "maintenance_failed" }, { status: 503 });
  }
}
