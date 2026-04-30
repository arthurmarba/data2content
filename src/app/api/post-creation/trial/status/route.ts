import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getPostCreationTrialAccess } from "@/app/lib/postCreationTrial/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await getPostCreationTrialAccess(userId);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error, reason: access.reason },
      { status: access.status }
    );
  }

  return NextResponse.json({
    ok: true,
    accountState: access.accountState,
    instagramConnected: access.instagramConnected,
    postCreationTrial: access.trial,
  });
}
