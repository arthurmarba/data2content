import { stripe } from "@/app/lib/stripe";
import { logger } from "@/app/lib/logger";
import { STRIPE_TAX_ID_TYPE, type TaxId } from "@/app/lib/billing/taxId";

/**
 * Espelha o documento no cliente do Stripe.
 *
 * Guardamos no nosso banco porque é dali que a emissão da nota vai ler. Mandar
 * para o Stripe também serve a outro propósito: o documento aparece na fatura
 * e no recibo que ele emite, e fica visível no painel quando alguém for
 * conferir uma cobrança.
 *
 * Nunca lança: falhar aqui não pode derrubar um cadastro ou um pagamento — o
 * dado que importa para a nota já está salvo do nosso lado.
 */
export async function syncTaxIdToStripe(
  customerId: string | null | undefined,
  taxId: TaxId,
): Promise<boolean> {
  if (!customerId) return false;

  try {
    const existing = await stripe.customers.listTaxIds(customerId, { limit: 20 });

    const alreadyThere = existing.data.find((entry) => entry.value === taxId.value);
    if (alreadyThere) return true;

    // Um cliente só tem um documento: os antigos saem para não sobrar dois
    // números diferentes na mesma fatura.
    await Promise.allSettled(
      existing.data
        .filter((entry) => entry.type === "br_cpf" || entry.type === "br_cnpj")
        .map((entry) => stripe.customers.deleteTaxId(customerId, entry.id)),
    );

    await stripe.customers.createTaxId(customerId, {
      type: STRIPE_TAX_ID_TYPE[taxId.type],
      value: taxId.value,
    });

    return true;
  } catch (error) {
    logger.warn("billing_tax_id_stripe_sync_failed", {
      customerId,
      taxIdType: taxId.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
