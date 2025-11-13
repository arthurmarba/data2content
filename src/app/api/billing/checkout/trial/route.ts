import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "TRIAL_DISABLED",
      message: "O teste gratuito foi descontinuado.",
    },
    { status: 410 }
  );
}
