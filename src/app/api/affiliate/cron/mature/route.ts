// src/app/api/affiliate/cron/mature/route.ts
import { NextRequest, NextResponse } from "next/server";
import matureAffiliateCommissions from "@/cron/matureAffiliateCommissions";

export const runtime = "nodejs";

/**
 * Segurança simples: exija um header secreto para disparar o cron.
 * Configure CRON_SECRET no ambiente e envie "x-cron-key: <valor>".
 */
const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    if (!CRON_SECRET || req.headers.get("x-cron-key") !== CRON_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { maxUsers, maxEntriesPerUser, dryRun } = body || {};

    const result = await matureAffiliateCommissions({
      dryRun: Boolean(dryRun),
      maxUsers,
      maxEntriesPerUser,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[affiliate/cron/mature] error:", err?.message || err);
    return NextResponse.json({ error: "cron error" }, { status: 500 });
  }
}
