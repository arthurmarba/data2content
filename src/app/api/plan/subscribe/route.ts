import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: "Endpoint de Mercado Pago descontinuado. Utilize /api/billing/subscribe.",
    },
    { status: 410 }
  );
}
