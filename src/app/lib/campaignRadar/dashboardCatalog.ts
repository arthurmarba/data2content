import { listDashboardCampaignRadarCatalog } from "./repository";
import { isConfirmedIndividualPay } from "./matching";

/** Só os campos públicos; revisão interna e evidências brutas não saem do serviço. */
export async function loadDashboardOpportunities() {
  const catalog = await listDashboardCampaignRadarCatalog();
  const now = Date.now();
  const today = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  return catalog.map((item) => ({
    id: item.id,
    /** Trancada para quem não assina; o acesso é decidido no servidor. */
    locked: false,
    availability: item.status === "closed" || (item.applicationDeadline && item.applicationDeadline.slice(0,10) < today)
      ? "closed" : item.status !== "open" || !item.applicationDeadline || now - Date.parse(item.lastVerifiedAt) > 8 * 86400000 ? "recheck" : "open",
    title: item.title,
    brand: item.brand,
    summary: item.summary,
    source: item.sourcePlatform,
    /** Identifica a fonte para o ícone servido por nós. */
    sourceId: item.sourceId ?? null,
    url: item.applicationUrl || item.sourceUrl,
    /** "Inscrever-se", "Ver edital" — o verbo que a própria chamada usa. */
    applicationLabel: item.applicationLabel ?? "",
    /** Inscrição exige criar conta na plataforma da fonte. */
    requiresAccount: item.requiresAccount === true,
    territories: item.territories,
    formats: item.formats,
    /** Instagram, TikTok — onde o conteúdo vai no ar. */
    platforms: item.platforms ?? [],
    requirements: item.requirements,
    deliverables: item.deliverables,
    /** Trechos do texto original: a prova de que a chamada existe e não foi inventada. */
    evidence: (item.evidence ?? []).map((entry) => ({ field: entry.field, excerpt: entry.excerpt })),
    deadline: item.applicationDeadline,
    verifiedAt: item.lastVerifiedAt,
    /** Quando o radar encontrou a chamada; é daqui que sai o selo "Novo". */
    discoveredAt: item.discoveredAt ?? null,
    publishedAt: item.publishedAt ?? null,
    includesProduct: item.compensation.includesProduct === true,
    payment: isConfirmedIndividualPay(item)
      ? "paid"
      : item.compensation.type === "barter"
        ? "barter"
        : "unknown",
    minimum: isConfirmedIndividualPay(item) ? item.compensation.minimum : null,
    compensation: isConfirmedIndividualPay(item)
      ? item.compensation.sourceText || "Cachê individual confirmado"
      : item.compensation.type === "barter"
        ? "Permuta"
        : "Cachê individual não confirmado",
  }));
}
export type DashboardOpportunity = Awaited<
  ReturnType<typeof loadDashboardOpportunities>
>[number];
