// src/app/api/affiliate/cron/mature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";

/**
 * Segurança simples: exija um header secreto para disparar o cron.
 * Configure CRON_SECRET no ambiente e envie "x-cron-key: <valor>".
 */
const CRON_SECRET = process.env.CRON_SECRET || "";

const normCur = (c?: string | null) => String(c || "").toLowerCase();

function addToBalance(u: any, currency: string, amountCents: number) {
  const cur = normCur(currency);
  let balances = u.affiliateBalances as Map<string, number> | Record<string, number> | undefined;

  let map: Map<string, number>;
  if (!balances) {
    map = new Map();
  } else if (balances instanceof Map) {
    map = balances as Map<string, number>;
  } else {
    map = new Map(Object.entries(balances || {})) as Map<string, number>;
  }

  const prev = map.get(cur) ?? 0;
  map.set(cur, prev + amountCents);
  u.affiliateBalances = map as any;
}

export async function POST(req: NextRequest) {
  try {
    if (!CRON_SECRET || req.headers.get("x-cron-key") !== CRON_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const now = new Date();

    // Busca usuários com pelo menos uma comissão pendente
    const users = await User.find({
      commissionLog: { $elemMatch: { status: "pending", availableAt: { $lte: now } } },
    }).select("_id email affiliateBalances commissionLog");

    let maturedUsers = 0;
    let maturedItems = 0;
    const perCurrencyTotals: Record<string, number> = {};

    for (const u of users) {
      let changed = false;

      for (const e of (u as any).commissionLog || []) {
        if (e.status === "pending" && e.availableAt && new Date(e.availableAt).valueOf() <= now.valueOf()) {
          e.status = "available";
          e.maturedAt = now;
          const cur = normCur(e.currency);
          const amt = Math.max(0, Number(e.amountCents || 0));
          addToBalance(u, cur, amt);

          perCurrencyTotals[cur] = (perCurrencyTotals[cur] || 0) + amt;
          maturedItems++;
          changed = true;
        }
      }

      if (changed) {
        await u.save();
        maturedUsers++;
      }
    }

    return NextResponse.json({
      ok: true,
      maturedUsers,
      maturedItems,
      totals: perCurrencyTotals,
      at: now.toISOString(),
    });
  } catch (err: any) {
    console.error("[affiliate/cron/mature] error:", err?.message || err);
    return NextResponse.json({ error: "cron error" }, { status: 500 });
  }
}
