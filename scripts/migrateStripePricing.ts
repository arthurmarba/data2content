/**
 * @fileoverview Migração de preços do plano Pro no Stripe.
 *
 * Dois níveis de preço:
 *   - "new"    → novos assinantes:   BRL 97,00/mês · 890/ano  | USD 19.40/mês · 179/ano
 *   - "legacy" → assinantes atuais:  BRL 79,90/mês · 690/ano  | USD 15.90/mês · 139/ano
 *
 * O que o script faz (idempotente):
 *   1. Garante as 8 Prices (4 BRL + 4 USD) no MESMO Product do plano atual,
 *      identificadas por `lookup_key` (não duplica em re-execuções).
 *   2. Migra assinaturas ATIVAS/TRIAL/PAST_DUE/UNPAID para os preços "legacy",
 *      casando por moeda + intervalo, SEM cobrança imediata
 *      (`proration_behavior: 'none'`, mantendo a data de renovação).
 *
 * Proteções:
 *   - Nunca rebaixa quem já está num preço "new" (novo assinante).
 *   - Pula quem já está num preço "legacy" (já migrado).
 *   - Pula assinaturas com múltiplos itens ou moeda/intervalo inesperados.
 *
 * Uso:
 *   Dry-run (padrão, não escreve nada):
 *     npx tsx --env-file=.env.local ./scripts/migrateStripePricing.ts
 *   Aplicar de verdade:
 *     npx tsx --env-file=.env.local ./scripts/migrateStripePricing.ts --apply
 *
 *   Product: derivado da price atual em STRIPE_PRICE_MONTHLY_BRL,
 *   ou informe STRIPE_PRODUCT_ID no ambiente.
 */

import type Stripe from "stripe";
import { stripe } from "@/app/lib/stripe";

const APPLY = process.argv.includes("--apply") || process.env.APPLY === "true";
const TAG = "[migrateStripePricing]";

type Tier = "new" | "legacy";
type Currency = "brl" | "usd";
type Interval = "month" | "year";

interface PriceSpec {
  lookupKey: string;
  tier: Tier;
  currency: Currency;
  interval: Interval;
  unitAmount: number; // menor unidade (centavos)
  nickname: string;
  /** env que deve apontar para esta price (só para as "new") */
  envVar?: string;
}

const PRICE_SPECS: PriceSpec[] = [
  // --- Novos assinantes (padrão) ---
  { lookupKey: "d2c_pro_new_monthly_brl", tier: "new", currency: "brl", interval: "month", unitAmount: 9700, nickname: "Pro Mensal (novo) BRL", envVar: "STRIPE_PRICE_MONTHLY_BRL" },
  { lookupKey: "d2c_pro_new_annual_brl", tier: "new", currency: "brl", interval: "year", unitAmount: 89000, nickname: "Pro Anual (novo) BRL", envVar: "STRIPE_PRICE_ANNUAL_BRL" },
  { lookupKey: "d2c_pro_new_monthly_usd", tier: "new", currency: "usd", interval: "month", unitAmount: 1940, nickname: "Pro Mensal (novo) USD", envVar: "STRIPE_PRICE_MONTHLY_USD" },
  { lookupKey: "d2c_pro_new_annual_usd", tier: "new", currency: "usd", interval: "year", unitAmount: 17900, nickname: "Pro Anual (novo) USD", envVar: "STRIPE_PRICE_ANNUAL_USD" },
  // --- Assinantes atuais (grandfather) ---
  { lookupKey: "d2c_pro_legacy_monthly_brl", tier: "legacy", currency: "brl", interval: "month", unitAmount: 7990, nickname: "Pro Mensal (legado) BRL" },
  { lookupKey: "d2c_pro_legacy_annual_brl", tier: "legacy", currency: "brl", interval: "year", unitAmount: 69000, nickname: "Pro Anual (legado) BRL" },
  { lookupKey: "d2c_pro_legacy_monthly_usd", tier: "legacy", currency: "usd", interval: "month", unitAmount: 1590, nickname: "Pro Mensal (legado) USD" },
  { lookupKey: "d2c_pro_legacy_annual_usd", tier: "legacy", currency: "usd", interval: "year", unitAmount: 13900, nickname: "Pro Anual (legado) USD" },
];

const MIGRATE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

function log(...args: unknown[]) {
  console.log(TAG, ...args);
}

function productIdOf(price: Stripe.Price): string | null {
  return typeof price.product === "string" ? price.product : price.product?.id ?? null;
}

/** Tenta resolver o Product a partir de uma price ID (silencioso se não existir). */
async function productFromPriceId(priceId: string | undefined): Promise<string | null> {
  if (!priceId) return null;
  try {
    const price = await stripe.prices.retrieve(priceId);
    return productIdOf(price);
  } catch {
    return null;
  }
}

/** Descobre o Product varrendo assinaturas ativas (fonte de verdade real). */
async function productFromActiveSubscriptions(): Promise<string | null> {
  const counts = new Map<string, number>();
  const iterator = stripe.subscriptions.list({
    status: "all",
    limit: 100,
    expand: ["data.items.data.price"],
  });
  for await (const sub of iterator) {
    if (!MIGRATE_STATUSES.has(sub.status)) continue;
    for (const item of sub.items?.data ?? []) {
      const pid = productIdOf(item.price as Stripe.Price);
      if (pid) counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  // Product mais frequente entre as assinaturas ativas
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length > 1) {
    log("Vários Products encontrados nas assinaturas ativas:", Object.fromEntries(sorted));
    log("Defina STRIPE_PRODUCT_ID no ambiente para escolher explicitamente.");
  }
  return sorted[0]![0];
}

async function resolveProductId(): Promise<string> {
  // 1) Explícito
  const explicit = process.env.STRIPE_PRODUCT_ID;
  if (explicit) {
    log("Product via STRIPE_PRODUCT_ID:", explicit);
    return explicit;
  }

  // 2) Qualquer uma das price IDs de env que ainda exista
  const envPriceIds = [
    process.env.STRIPE_PRICE_MONTHLY_BRL,
    process.env.STRIPE_PRICE_ANNUAL_BRL,
    process.env.STRIPE_PRICE_MONTHLY_USD,
    process.env.STRIPE_PRICE_ANNUAL_USD,
  ];
  for (const pid of envPriceIds) {
    const product = await productFromPriceId(pid);
    if (product) {
      log(`Product resolvido via price de env (${pid}):`, product);
      return product;
    }
  }

  // 3) Fallback: a partir das assinaturas ativas
  log("Nenhuma price de env válida; tentando descobrir o Product pelas assinaturas ativas...");
  const fromSubs = await productFromActiveSubscriptions();
  if (fromSubs) {
    log("Product resolvido via assinaturas ativas:", fromSubs);
    return fromSubs;
  }

  throw new Error(
    "Não foi possível resolver o Product automaticamente. Defina STRIPE_PRODUCT_ID (prod_...) no .env.local — encontre no Dashboard do Stripe em Products → plano Pro."
  );
}

/** Garante uma Price pelo lookup_key. Em dry-run, não cria (retorna null). */
async function ensurePrice(
  productId: string,
  spec: PriceSpec
): Promise<{ id: string | null; existed: boolean }> {
  const existing = await stripe.prices.list({
    lookup_keys: [spec.lookupKey],
    active: true,
    limit: 1,
  });

  const found = existing.data[0];
  if (found) {
    // Sanidade: confere valor/moeda/intervalo
    const mismatch =
      found.unit_amount !== spec.unitAmount ||
      found.currency !== spec.currency ||
      found.recurring?.interval !== spec.interval;
    if (mismatch) {
      log(
        `⚠️  Price existente ${found.id} (lookup=${spec.lookupKey}) diverge do esperado`,
        {
          esperado: { unitAmount: spec.unitAmount, currency: spec.currency, interval: spec.interval },
          atual: { unitAmount: found.unit_amount, currency: found.currency, interval: found.recurring?.interval },
        }
      );
    }
    return { id: found.id, existed: true };
  }

  if (!APPLY) {
    log(`(dry-run) criaria Price ${spec.lookupKey} = ${spec.unitAmount} ${spec.currency}/${spec.interval}`);
    return { id: null, existed: false };
  }

  const created = await stripe.prices.create({
    product: productId,
    currency: spec.currency,
    unit_amount: spec.unitAmount,
    recurring: { interval: spec.interval },
    lookup_key: spec.lookupKey,
    nickname: spec.nickname,
    metadata: { d2c_tier: spec.tier, d2c_lookup: spec.lookupKey },
  });
  log(`✅ Price criada ${created.id} (${spec.lookupKey} = ${spec.unitAmount} ${spec.currency}/${spec.interval})`);
  return { id: created.id, existed: false };
}

async function main() {
  log(APPLY ? "MODO APPLY — escrevendo no Stripe" : "MODO DRY-RUN — nenhuma escrita será feita");

  const productId = await resolveProductId();
  log("Product:", productId);

  // 1) Garante as 8 prices
  const priceIdByLookup = new Map<string, string | null>();
  for (const spec of PRICE_SPECS) {
    const { id } = await ensurePrice(productId, spec);
    priceIdByLookup.set(spec.lookupKey, id);
  }

  // Mapas auxiliares
  const newPriceIds = new Set<string>();
  const legacyByKey = new Map<string, string | null>(); // `${currency}_${interval}` -> priceId
  const legacyPriceIds = new Set<string>();

  for (const spec of PRICE_SPECS) {
    const id = priceIdByLookup.get(spec.lookupKey) ?? null;
    if (spec.tier === "new" && id) newPriceIds.add(id);
    if (spec.tier === "legacy") {
      legacyByKey.set(`${spec.currency}_${spec.interval}`, id);
      if (id) legacyPriceIds.add(id);
    }
  }

  // Envs a configurar no Vercel (novos assinantes)
  log("──────── ENV para novos assinantes (configurar no Vercel) ────────");
  for (const spec of PRICE_SPECS) {
    if (!spec.envVar) continue;
    const id = priceIdByLookup.get(spec.lookupKey);
    log(`  ${spec.envVar}=${id ?? "(será criada no --apply)"}`);
  }
  log("──────────────────────────────────────────────────────────────────");

  // 2) Migração das assinaturas
  const counters = {
    scanned: 0,
    migrated: 0,
    wouldMigrate: 0,
    skippedNew: 0,
    skippedLegacy: 0,
    skippedStatus: 0,
    skippedMultiItem: 0,
    skippedUnsupported: 0,
    errors: 0,
  };

  const iterator = stripe.subscriptions.list({
    status: "all",
    limit: 100,
    expand: ["data.items.data.price"],
  });

  for await (const sub of iterator) {
    counters.scanned += 1;

    if (!MIGRATE_STATUSES.has(sub.status)) {
      counters.skippedStatus += 1;
      continue;
    }

    const items = sub.items?.data ?? [];
    if (items.length !== 1) {
      counters.skippedMultiItem += 1;
      log(`⚠️  sub ${sub.id}: ${items.length} itens — pulando (revisar manualmente)`);
      continue;
    }

    const item = items[0]!;
    const price = item.price as Stripe.Price;
    const currency = price.currency as Currency;
    const interval = price.recurring?.interval as Interval | undefined;

    // Já é preço novo → é assinante NOVO, não rebaixar
    if (price.id && newPriceIds.has(price.id)) {
      counters.skippedNew += 1;
      continue;
    }
    // Já é preço legado → já migrado
    if (price.id && legacyPriceIds.has(price.id)) {
      counters.skippedLegacy += 1;
      continue;
    }

    if (!interval || (interval !== "month" && interval !== "year") || (currency !== "brl" && currency !== "usd")) {
      counters.skippedUnsupported += 1;
      log(`⚠️  sub ${sub.id}: moeda/intervalo não suportado (${currency}/${interval}) — pulando`);
      continue;
    }

    const targetPriceId = legacyByKey.get(`${currency}_${interval}`) ?? null;

    if (!targetPriceId) {
      // Só acontece em dry-run (price legada ainda não existe)
      counters.wouldMigrate += 1;
      log(`(dry-run) migraria sub ${sub.id} [${sub.status}] ${price.id} (${currency}/${interval}) → legacy ${currency}_${interval} (a criar)`);
      continue;
    }

    if (!APPLY) {
      counters.wouldMigrate += 1;
      log(`(dry-run) migraria sub ${sub.id} [${sub.status}] ${price.id} → ${targetPriceId}`);
      continue;
    }

    try {
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, price: targetPriceId }],
        proration_behavior: "none",
        billing_cycle_anchor: "unchanged",
        metadata: {
          ...(sub.metadata ?? {}),
          d2c_price_migration: "legacy_2026",
        },
      });
      counters.migrated += 1;
      log(`✅ sub ${sub.id} migrada → ${targetPriceId}`);
    } catch (err) {
      counters.errors += 1;
      log(`❌ erro ao migrar sub ${sub.id}:`, err instanceof Error ? err.message : err);
    }
  }

  log("──────── RESUMO ────────");
  log(JSON.stringify(counters, null, 2));
  if (!APPLY) {
    log("Dry-run concluído. Rode novamente com --apply para efetivar.");
  } else {
    log("Aplicação concluída.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(TAG, "falhou:", err);
    process.exit(1);
  });
