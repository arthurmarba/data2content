import type { DashboardOpportunity } from "./dashboardCatalog";

export const FREE_OPPORTUNITY_LIMIT = 3;

const byDeadline = (a: DashboardOpportunity, b: DashboardOpportunity) =>
  (a.deadline ? Date.parse(a.deadline) : Infinity) - (b.deadline ? Date.parse(b.deadline) : Infinity);

/**
 * Livres para quem não assina: as de maior cachê confirmado, e cada uma segue
 * livre até o prazo dela vencer (encerrada não ocupa vaga). Sem três com cachê,
 * completa com as de prazo mais próximo.
 */
export function selectFreeOpportunityIds(
  items: DashboardOpportunity[],
  limit = FREE_OPPORTUNITY_LIMIT,
): Set<string> {
  const abertas = items.filter((item) => item.availability !== "closed");
  const comCache = abertas
    .filter((item) => item.payment === "paid")
    .sort((a, b) => (b.minimum ?? 0) - (a.minimum ?? 0) || byDeadline(a, b));
  const demais = abertas.filter((item) => item.payment !== "paid").sort(byDeadline);
  return new Set([...comCache, ...demais].slice(0, limit).map((item) => item.id));
}

/**
 * Cadeado na tela sem trava no servidor é enfeite: quem não assina não recebe o
 * link de inscrição nem os detalhes. Marca, título, pagamento e prazo continuam,
 * porque são a prova de que a oportunidade é real.
 */
export function applyOpportunityAccess(
  items: DashboardOpportunity[],
  { hasProAccess }: { hasProAccess: boolean },
): DashboardOpportunity[] {
  if (hasProAccess) return items;
  const livres = selectFreeOpportunityIds(items);
  return items.map((item) =>
    livres.has(item.id)
      ? item
      : { ...item, locked: true, url: "", summary: "", deliverables: [], requirements: [] },
  );
}
