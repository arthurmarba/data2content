// src/app/api/billing/status/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cacheHeader = { "Cache-Control": "no-store, max-age=0" } as const;

type PlanStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "canceled"
  | "inactive"
  | "non_renewing";

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

    // Status bruto salvo no DB (real do Stripe)
    const raw: Exclude<PlanStatus, "non_renewing"> | undefined = (user as any).planStatus;
    const cancelAtPeriodEnd = Boolean((user as any).cancelAtPeriodEnd);

    // Para a UI: quando há cancelamento agendado, mostramos "non_renewing"
    const uiStatus: PlanStatus = cancelAtPeriodEnd ? "non_renewing" : (raw ?? "inactive");

    const expiresAt = (user as any).planExpiresAt ?? null;

    // Só mostrar intervalo quando a assinatura "existe" (evita exibir Mensal pra inativo)
    const showIntervalStatuses: ReadonlySet<PlanStatus> = new Set([
      "active",
      "trialing",
      "non_renewing",
      "past_due",
      "unpaid",
    ]);
    const interval =
      showIntervalStatuses.has(uiStatus) ? (user as any).planInterval ?? null : null;

    // Quando encerra/encerrou (inclui non_renewing)
    const cancelAt =
      uiStatus === "canceled" || uiStatus === "non_renewing" ? expiresAt : null;

    // Acesso ainda ativo?
    const hasActiveAccess =
      uiStatus === "active" || uiStatus === "trialing" || uiStatus === "non_renewing";

    // Pode excluir? Só se não tem sub ou já está definitivamente encerrada/expirada
    const canDeleteAccount =
      !(user as any).stripeSubscriptionId ||
      uiStatus === "canceled" ||
      uiStatus === "incomplete_expired";

    // Normaliza lastPaymentError pra string (se existir)
    const lastPaymentErrorObj: any = (user as any).lastPaymentError ?? null;
    const lastPaymentError =
      typeof lastPaymentErrorObj === "string"
        ? lastPaymentErrorObj
        : lastPaymentErrorObj?.statusDetail ?? null;

    return NextResponse.json(
      {
        ok: true,
        planStatus: uiStatus,                     // <- status para UI
        planInterval: interval,
        planExpiresAt: expiresAt,
        cancelAt,
        cancelAtPeriodEnd,
        hasActiveAccess,
        canDeleteAccount,
        stripeSubscriptionId: (user as any).stripeSubscriptionId ?? null,
        stripePriceId: (user as any).stripePriceId ?? null,
        lastPaymentError,
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
