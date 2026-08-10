import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import { checkRateLimit } from "@/utils/rateLimit";
import {
  TAX_ID_INVALID_MESSAGE,
  formatTaxId,
  parseTaxId,
} from "@/app/lib/billing/taxId";
import { syncTaxIdToStripe } from "@/app/lib/billing/syncTaxIdToStripe";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

async function loadAuthOptions() {
  if (process.env.NODE_ENV === "test") {
    return {} as any;
  }
  const mod = await import("@/app/api/auth/[...nextauth]/route");
  return mod.authOptions as any;
}

/** Diz se já temos o documento — usado para decidir se o campo aparece. */
export async function GET() {
  const authOptions = await loadAuthOptions();
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStoreHeaders });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).select("taxId taxIdType").lean();

  const taxId = (user as any)?.taxId ?? null;
  return NextResponse.json(
    {
      hasTaxId: Boolean(taxId),
      taxIdType: (user as any)?.taxIdType ?? null,
      // Só o formatado volta: serve para confirmar visualmente, não para
      // reidratar formulário.
      taxIdMasked: taxId ? formatTaxId(taxId) : null,
    },
    { headers: noStoreHeaders },
  );
}

export async function POST(req: NextRequest) {
  try {
    const authOptions = await loadAuthOptions();
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStoreHeaders });
    }

    const { allowed } = await checkRateLimit(`tax_id:${session.user.id}`, 10, 60);
    if (!allowed) {
      return NextResponse.json(
        { code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde um instante." },
        { status: 429, headers: noStoreHeaders },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = parseTaxId((body as any)?.taxId);
    if (!parsed) {
      return NextResponse.json(
        { code: "INVALID_TAX_ID", message: TAX_ID_INVALID_MESSAGE },
        { status: 422, headers: noStoreHeaders },
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404, headers: noStoreHeaders });
    }

    (user as any).taxId = parsed.value;
    (user as any).taxIdType = parsed.type;
    (user as any).taxIdUpdatedAt = new Date();
    await user.save();

    // Best-effort: o dado que a nota precisa já está salvo acima.
    const synced = await syncTaxIdToStripe((user as any).stripeCustomerId, parsed);

    logger.info("billing_tax_id_saved", {
      endpoint: "POST /api/billing/tax-id",
      userId: String(user._id),
      taxIdType: parsed.type,
      stripeSynced: synced,
    });

    return NextResponse.json(
      { ok: true, taxIdType: parsed.type, taxIdMasked: formatTaxId(parsed.value) },
      { headers: noStoreHeaders },
    );
  } catch (error: any) {
    logger.error("[billing/tax-id] error", error);
    return NextResponse.json(
      { code: "TAX_ID_SAVE_FAILED", message: "Não foi possível salvar o documento." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
