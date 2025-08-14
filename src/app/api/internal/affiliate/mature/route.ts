import { User } from "@/server/db/models/User";
import { adjustBalance } from "@/server/affiliate/balance";

export async function POST(req: Request) {
  const token = req.headers.get("x-internal-secret");
  if (token !== process.env.INTERNAL_CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const batch = await User.find({
    commissionLog: { $elemMatch: { status: "pending", availableAt: { $lte: now } } }
  }).limit(100);

  let matured = 0;
  for (const u of batch) {
    let dirty = false;
    for (const e of (u as any).commissionLog) {
      if (e.type === "commission" && e.status === "pending" && e.availableAt && e.availableAt <= now) {
        await adjustBalance(u, e.currency, e.amountCents);
        e.status = "available";
        e.maturedAt = new Date();
        dirty = true; matured++;
      }
    }
    if (dirty) await u.save();
  }

  return Response.json({ matured, processedUsers: batch.length });
}
