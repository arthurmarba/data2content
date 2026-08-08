import type Stripe from "stripe";

/**
 * Teto e validade da campanha d2cVIP.
 *
 * O Stripe não deixa acrescentar `max_redemptions` nem `expires_at` a um
 * promotion code que já existe — os dois são imutáveis após a criação. Trocar
 * isso exigiria desativar o cupom vivo e recriar, no meio da campanha.
 *
 * Então o freio mora aqui, lido de env. A contagem não é nossa: usamos o
 * `times_redeemed` do próprio Stripe, que é a fonte de verdade e não desanda se
 * o nosso banco divergir. Mudar o teto é mudar uma variável, sem tocar em nada
 * que já foi vendido.
 *
 * Este módulo é server-only: nunca importe de um componente "use client".
 */

export type VipCampaignVerdict =
  | { available: true }
  | { available: false; reason: "expired" | "sold_out" };

export type VipCampaignLimits = {
  maxRedemptions: number | null;
  expiresAt: Date | null;
};

function parseMaxRedemptions(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseExpiresAt(raw: string | undefined): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveVipCampaignLimits(
  env: NodeJS.ProcessEnv = process.env,
): VipCampaignLimits {
  return {
    maxRedemptions: parseMaxRedemptions(env.D2C_VIP_MAX_REDEMPTIONS),
    expiresAt: parseExpiresAt(env.D2C_VIP_EXPIRES_AT),
  };
}

/**
 * Sem limites configurados a campanha segue aberta — o comportamento de hoje.
 * Ligar o freio é definir a env, não fazer deploy.
 */
export function checkVipCampaignWindow(params: {
  promotionCode: Pick<Stripe.PromotionCode, "times_redeemed"> | null;
  limits?: VipCampaignLimits;
  now?: Date;
}): VipCampaignVerdict {
  const limits = params.limits ?? resolveVipCampaignLimits();
  const now = params.now ?? new Date();

  if (limits.expiresAt && now.getTime() >= limits.expiresAt.getTime()) {
    return { available: false, reason: "expired" };
  }

  if (limits.maxRedemptions != null) {
    const redeemed = params.promotionCode?.times_redeemed ?? 0;
    if (redeemed >= limits.maxRedemptions) {
      return { available: false, reason: "sold_out" };
    }
  }

  return { available: true };
}

export function vipCampaignMessage(reason: "expired" | "sold_out"): string {
  return reason === "expired"
    ? "Este cupom expirou."
    : "Este cupom já atingiu o limite de usos.";
}
