import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cacheHeader = { "Cache-Control": "no-store, max-age=0" } as const;

/**
 * Normaliza os dados do usuário para a UI de cobrança.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401, headers: cacheHeader }
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).lean();
    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404, headers: cacheHeader }
      );
    }

    const status = user.planStatus ?? "inactive";
    const interval = user.planInterval ?? null;
    const expiresAt = user.planExpiresAt ?? null;
    const cancelAt = status === "canceled" ? expiresAt : null;

    return NextResponse.json(
      {
        planStatus: status,
        planInterval: interval,
        planExpiresAt: expiresAt,
        cancelAt,
        stripeSubscriptionId: user.stripeSubscriptionId ?? null,
        stripePriceId: user.stripePriceId ?? null,
        lastPaymentError: user.lastPaymentError ?? null,
      },
      { headers: cacheHeader }
    );
  } catch (err) {
    console.error("[billing/status] error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: cacheHeader }
    );
  }
}
