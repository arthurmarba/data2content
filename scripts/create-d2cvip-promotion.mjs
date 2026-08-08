import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY ausente.");
}

// Script operacional isolado: não roda dentro da aplicação Next.js.
// eslint-disable-next-line no-restricted-syntax
const stripe = new Stripe(secretKey, {
  apiVersion: process.env.STRIPE_API_VERSION || "2025-07-30.basil",
});

const displayCode = "d2cVIP";
const existing = await stripe.promotionCodes.list({
  code: displayCode,
  active: true,
  limit: 10,
});

if (existing.data.length > 0) {
  const promotionCode = existing.data[0];
  const coupon = promotionCode.coupon;
  const matchesExpectedConfiguration =
    coupon.percent_off === 100 &&
    coupon.duration === "once" &&
    promotionCode.restrictions.first_time_transaction === true;

  if (!matchesExpectedConfiguration) {
    throw new Error(
      `O código ${displayCode} já existe com uma configuração diferente. Revise ${promotionCode.id} no Stripe.`,
    );
  }

  console.log(JSON.stringify({
    created: false,
    promotionCodeId: promotionCode.id,
    couponId: coupon.id,
    code: promotionCode.code,
    livemode: promotionCode.livemode,
  }));
  process.exit(0);
}

const coupon = await stripe.coupons.create({
  name: displayCode,
  percent_off: 100,
  duration: "once",
  metadata: {
    campaign: "d2c_vip",
    eligible_plan: "monthly",
    benefit: "first_month_free",
  },
});

// ATENÇÃO: max_redemptions e expires_at são IMUTÁVEIS depois da criação — o
// Stripe recusa os dois num update. Definir aqui é a única chance; para um
// código que já existe, o teto e a validade são aplicados pela aplicação
// (D2C_VIP_MAX_REDEMPTIONS / D2C_VIP_EXPIRES_AT, ver d2cVipCampaign.ts).
const maxRedemptions = Number(process.env.D2C_VIP_MAX_REDEMPTIONS) || null;
const expiresAt = process.env.D2C_VIP_EXPIRES_AT
  ? Math.floor(new Date(process.env.D2C_VIP_EXPIRES_AT).getTime() / 1000)
  : null;

const promotionCode = await stripe.promotionCodes.create({
  coupon: coupon.id,
  code: displayCode,
  restrictions: {
    first_time_transaction: true,
  },
  ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
  ...(expiresAt ? { expires_at: expiresAt } : {}),
  metadata: {
    campaign: "d2c_vip",
    eligible_plan: "monthly",
  },
});

console.log(JSON.stringify({
  created: true,
  promotionCodeId: promotionCode.id,
  couponId: coupon.id,
  code: promotionCode.code,
  livemode: promotionCode.livemode,
}));
