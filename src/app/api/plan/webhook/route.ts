import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: "Webhook de Mercado Pago descontinuado.",
    },
    { status: 410 }
  );
}
