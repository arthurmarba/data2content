import { stripe } from "@/app/lib/stripe";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { sendFreeMonthEndingEmail } from "@/app/lib/emailService";
import { D2C_VIP_PROMOTION_CODE } from "@/app/lib/billing/d2cVipPromotion";
import type Stripe from "stripe";

const TAG = "[cron.notifyFreeMonthEnding]";

/** Quantos dias antes da primeira cobrança o aviso sai. */
const NOTICE_DAYS = Number(process.env.FREE_MONTH_NOTICE_DAYS ?? "3");

/** Marca no Stripe que o aviso já saiu, para o job ser idempotente. */
const SENT_METADATA_KEY = "free_month_notice_sent_for";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * O fim do ciclo mudou de lugar na API Basil: vive no item, com o campo antigo
 * ainda presente em assinaturas mais velhas.
 */
function resolvePeriodEnd(sub: Stripe.Subscription): number | null {
  const fromItems = sub.items?.data
    ?.map((item) => (item as any).current_period_end)
    .filter((value: unknown): value is number => typeof value === "number");
  if (fromItems && fromItems.length > 0) return Math.min(...fromItems);
  const legacy = (sub as any).current_period_end;
  return typeof legacy === "number" ? legacy : null;
}

function resolveAmountCents(sub: Stripe.Subscription): number {
  const price = sub.items?.data?.[0]?.price;
  return typeof price?.unit_amount === "number" ? price.unit_amount : 0;
}

export type FreeMonthNoticeResult = {
  scanned: number;
  matched: number;
  sent: number;
  skipped: number;
  failed: number;
};

/**
 * Avisa quem entrou com o mês grátis do d2cVIP que a primeira cobrança está
 * chegando.
 *
 * O benefício é cupom e não trial, então o Stripe não manda o aviso de "seu
 * teste está acabando". Sem este job a pessoa é cobrada em silêncio — que é
 * exatamente como se fabrica um chargeback.
 */
export default async function notifyFreeMonthEnding(): Promise<FreeMonthNoticeResult> {
  await connectToDatabase();

  const now = Date.now();
  const windowStart = Math.floor((now + (NOTICE_DAYS - 1) * DAY_MS) / 1000);
  const windowEnd = Math.floor((now + (NOTICE_DAYS + 1) * DAY_MS) / 1000);

  const result: FreeMonthNoticeResult = {
    scanned: 0,
    matched: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for await (const sub of stripe.subscriptions.list({
    status: "active",
    limit: 100,
    expand: ["data.items.data.price"],
  })) {
    result.scanned += 1;

    if (sub.metadata?.promotionCode !== D2C_VIP_PROMOTION_CODE) continue;

    const periodEnd = resolvePeriodEnd(sub);
    if (periodEnd == null) continue;
    if (periodEnd < windowStart || periodEnd > windowEnd) continue;

    result.matched += 1;

    // Quem já agendou o cancelamento não vai ser cobrado: avisar seria ruído.
    if (sub.cancel_at_period_end) {
      result.skipped += 1;
      continue;
    }

    // Idempotência ancorada na data da cobrança: o aviso do próximo ciclo, se um
    // dia existir, não é bloqueado por este.
    if (sub.metadata?.[SENT_METADATA_KEY] === String(periodEnd)) {
      result.skipped += 1;
      continue;
    }

    const userId = sub.metadata?.userId;
    if (!userId) {
      logger.warn(`${TAG} assinatura sem userId na metadata`, { subscriptionId: sub.id });
      result.skipped += 1;
      continue;
    }

    const user = await User.findById(userId).select("email name").lean();
    const email = (user as any)?.email;
    if (!email) {
      logger.warn(`${TAG} usuário sem e-mail`, { subscriptionId: sub.id, userId });
      result.skipped += 1;
      continue;
    }

    try {
      await sendFreeMonthEndingEmail(email, {
        name: (user as any)?.name ?? null,
        chargeDate: new Date(periodEnd * 1000),
        amountCents: resolveAmountCents(sub),
        currency: (sub.items?.data?.[0]?.price?.currency ?? "brl").toUpperCase(),
      });

      // Só marca depois do envio confirmado — marcar antes trocaria um e-mail
      // duplicado por uma cobrança sem aviso.
      await stripe.subscriptions.update(sub.id, {
        metadata: { ...sub.metadata, [SENT_METADATA_KEY]: String(periodEnd) },
      });

      result.sent += 1;
      logger.info(`${TAG} aviso enviado`, { subscriptionId: sub.id, userId });
    } catch (error) {
      result.failed += 1;
      logger.error(`${TAG} falha ao avisar`, {
        subscriptionId: sub.id,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info(`${TAG} concluído`, result as unknown as Record<string, unknown>);
  return result;
}
