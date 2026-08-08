/**
 * Destrava usuários deixados em "pending" por um checkout hospedado abandonado.
 *
 * Um checkout hospedado (fluxo d2cVIP e o fallback sem PaymentIntent) marcava o
 * usuário como "pending" ANTES do pagamento e sem stripeSubscriptionId. Quem
 * fechava a aba do Stripe ficava travado: toda nova tentativa de assinar batia
 * em BILLING_BLOCKED_PENDING_OR_INCOMPLETE até achar "Resolver pendência".
 *
 * A causa já foi corrigida no código. Este script limpa quem ficou para trás.
 *
 * Uso:
 *   MONGODB_URI=... node scripts/fix-orphan-pending-checkouts.mjs          # diagnóstico
 *   MONGODB_URI=... node scripts/fix-orphan-pending-checkouts.mjs --apply  # corrige
 *
 * Com STRIPE_SECRET_KEY definido, confirma no Stripe que o cliente realmente
 * não tem assinatura nenhuma antes de mexer.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

// Aponte para o .env de produção com ENV_FILE=... se ele não for o .env.local.
dotenv.config({ path: process.env.ENV_FILE || ".env.local" });

const APPLY = process.argv.includes("--apply");
const MONGODB_URI = process.env.MONGODB_URI;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI ausente.");
}

let stripe = null;
if (STRIPE_SECRET_KEY) {
  const { default: Stripe } = await import("stripe");
  // eslint-disable-next-line no-restricted-syntax
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

// A URI não carrega o nome do banco: sem dbName a conexão cai no "test" e o
// diagnóstico devolve zero por olhar a coleção errada. Mesma resolução de
// src/app/lib/mongoose.ts.
const dbName = process.env.MONGODB_DB_NAME || process.env.DB_NAME || "data2content";
await mongoose.connect(MONGODB_URI, { dbName });
console.log(`Banco: ${mongoose.connection.name}\n`);
const users = mongoose.connection.db.collection("users");

const candidates = await users
  .find(
    {
      planStatus: { $in: ["pending", "incomplete"] },
      $or: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: { $exists: false } }],
    },
    { projection: { email: 1, planStatus: 1, stripeCustomerId: 1, planType: 1, updatedAt: 1 } },
  )
  .sort({ updatedAt: -1 })
  .toArray();

console.log(`Usuários em pending/incomplete sem assinatura: ${candidates.length}`);

const toFix = [];
const skipped = [];

for (const user of candidates) {
  let hasSubscription = false;

  if (stripe && user.stripeCustomerId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 10,
      });
      // "incomplete_expired" e "canceled" são tentativas mortas: não há nada a
      // reconciliar e o usuário continua trancado fora da compra. Só uma
      // assinatura viva (ou recuperável) impede o reset.
      hasSubscription = subs.data.some(
        (sub) => !["incomplete_expired", "canceled"].includes(sub.status),
      );
    } catch (error) {
      // Cliente sumido do Stripe é exatamente o caso que queremos limpar.
      const missing = error?.raw?.code === "resource_missing";
      if (!missing) {
        skipped.push({ user, reason: `stripe: ${error?.message ?? error}` });
        continue;
      }
    }
  }

  if (hasSubscription) {
    skipped.push({ user, reason: "tem assinatura no Stripe — precisa de reconciliação, não de reset" });
    continue;
  }

  toFix.push(user);
}

console.log(`\nPara destravar: ${toFix.length}`);
for (const user of toFix) {
  const when = user.updatedAt ? new Date(user.updatedAt).toISOString().slice(0, 10) : "?";
  console.log(`  ${when}  ${user.planStatus}  ${user.email ?? user._id}`);
}

if (skipped.length > 0) {
  console.log(`\nIgnorados: ${skipped.length}`);
  for (const { user, reason } of skipped) {
    console.log(`  ${user.email ?? user._id} — ${reason}`);
  }
}

if (!APPLY) {
  console.log("\n(diagnóstico apenas — rode com --apply para corrigir)");
  await mongoose.disconnect();
  process.exit(0);
}

if (toFix.length === 0) {
  console.log("\nNada a fazer.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await users.updateMany(
  { _id: { $in: toFix.map((u) => u._id) } },
  {
    $set: {
      planStatus: "inactive",
      pendingCheckoutSessionId: null,
      pendingCheckoutExpiresAt: null,
      planExpiresAt: null,
      cancelAtPeriodEnd: false,
    },
  },
);

console.log(`\nDestravados: ${result.modifiedCount}`);
await mongoose.disconnect();
