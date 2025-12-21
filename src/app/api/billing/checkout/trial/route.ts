import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: false,
      code: "TRIAL_DISABLED",
      message: "O teste gratuito foi descontinuado.",
    },
    { status: 410 }
  );
}
