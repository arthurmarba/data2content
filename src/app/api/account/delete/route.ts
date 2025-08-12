import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "NotFound" }, { status: 404 });
    }

    const blocked = ["active", "trial", "pending"].includes(user.planStatus);
    if (blocked) {
      logger.warn("[account.delete] blocked due to active subscription", { userId: user._id });
      return NextResponse.json(
        {
          error: "ERR_ACTIVE_SUBSCRIPTION",
          message: "Cancele sua assinatura antes de excluir a conta.",
        },
        { status: 409 }
      );
    }

    const balances =
      user.affiliateBalances instanceof Map
        ? Object.fromEntries(user.affiliateBalances as any)
        : (user.affiliateBalances || {});
    if (balances && Object.values(balances).some((v: any) => v > 0)) {
      logger.warn("[account.delete] deleting account with affiliate balances", { userId: user._id, balances });
    }

    await User.deleteOne({ _id: user._id });
    logger.info("[account.delete] user deleted", { userId: user._id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error("[account.delete] error", e);
    return NextResponse.json({ error: "InternalError" }, { status: 500 });
  }
}
