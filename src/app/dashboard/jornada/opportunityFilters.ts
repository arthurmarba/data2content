import type { DashboardOpportunity } from "@/app/lib/campaignRadar/dashboardCatalog";
export function filterOpportunities(
  items: DashboardOpportunity[],
  query: string,
  source: string,
  territory: string,
  payment: string,
  format: string,
  order: string,
  availability = "",
) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return items
    .filter(
      (item) =>
        (!query ||
          normalize(
            [item.title, item.brand, item.summary, ...item.territories].join(
              " ",
            ),
          ).includes(normalize(query))) &&
        (!availability || item.availability === availability) &&
        (!source || item.source === source) &&
        (!territory || item.territories.includes(territory)) &&
        (!payment || item.payment === payment) &&
        (!format || item.formats.includes(format)),
    )
    // Encerradas vão para o fim em qualquer ordenação: com prazo no passado, elas
    // ocupavam o topo da ordem por prazo e escondiam as chamadas abertas.
    .sort((a, b) =>
      Number(a.availability === "closed") - Number(b.availability === "closed") ||
      (order === "payment"
        ? (b.minimum ?? -1) - (a.minimum ?? -1)
        : order === "recent"
          ? Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt)
          : (a.deadline ? Date.parse(a.deadline) : Infinity) -
            (b.deadline ? Date.parse(b.deadline) : Infinity)),
    );
}
