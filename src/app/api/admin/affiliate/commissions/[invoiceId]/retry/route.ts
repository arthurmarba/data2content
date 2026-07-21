import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A transferência avulsa por invoice ignora estornos parciais, saldo consolidado
 * e resgates já iniciados. Ela permanece explicitamente fechada para impedir que
 * um operador pague a mesma comissão por dois fluxos diferentes.
 */
export async function POST(
  _req: NextRequest,
  _context: { params: { invoiceId: string } },
) {
  const session = (await getServerSession(authOptions)) as any;
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: "Reprocessamento direto desativado por segurança. Use a conciliação de resgates.",
      code: "DIRECT_COMMISSION_RETRY_DISABLED",
    },
    { status: 409 },
  );
}
