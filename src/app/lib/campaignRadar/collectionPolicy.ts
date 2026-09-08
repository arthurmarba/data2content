import { campaignRadarSourceRegistry, sourceRegistryEntry } from "./sourceRegistry";

export interface CollectionPolicy {
  sourceId: string;
  cost: "free_confirmed" | "unknown" | "paid";
  permission: "internal_discovery" | "manual_only" | "blocked" | "pending";
  urls: string[];
  reviewedOn: string | null;
  reviewExpiresOn: string | null;
  evidence: string;
}

// Somente HTML público, sem chave, intermediário ou endpoint faturável.
// Revisão para descoberta interna, conforme o recorte solicitado pelo Arthur.
const reviewed: Record<string, CollectionPolicy> = {
  "upabc-public-coverage": {
    sourceId: "upabc-public-coverage", cost: "free_confirmed", permission: "internal_discovery",
    urls: ["https://ajuda.upabc.com.br/index.php?catid=16&id=45&view=article"],
    reviewedOn: "2026-09-07", reviewExpiresOn: "2026-10-07",
    evidence: "Página pública consultada em 07/09/2026, sem login, cobrança ou proibição de coleta identificada na página. Formulário externo fora da coleta. Redistribuição pendente.",
  },
  "tijuca-geek-public-coverage": {
    sourceId: "tijuca-geek-public-coverage", cost: "free_confirmed", permission: "internal_discovery",
    urls: ["https://www.tijucageekfestival.com.br/"],
    reviewedOn: "2026-09-07", reviewExpiresOn: "2026-10-07",
    evidence: "Página pública consultada em 07/09/2026, sem login, cobrança ou proibição de coleta identificada na página. Formulários externos fora da coleta. Redistribuição pendente.",
  },
};

export function collectionPolicy(sourceId: string): CollectionPolicy {
  if (reviewed[sourceId]) return reviewed[sourceId]!;
  const entry = sourceRegistryEntry(sourceId);
  return {
    sourceId, cost: sourceId === "x-search" ? "paid" : "unknown",
    permission: sourceId === "x-search" || entry?.pluginDistribution.status === "blocked" ? "blocked"
      : entry && ["authenticated", "profile_selected"].includes(entry.inventoryVisibility) ? "manual_only" : "pending",
    urls: [], reviewedOn: null, reviewExpiresOn: null,
    evidence: sourceId === "x-search" ? "Busca oficial paga; excluída por decisão do produto."
      : sourceId === "threads-search" ? "Gratuidade e acesso de busca ainda não confirmados para o aplicativo."
      : "Coleta automática desativada até revisão da origem e confirmação de custo zero.",
  };
}

export function collectionBlockReason(policy: CollectionPolicy, now = new Date()): string | null {
  if (policy.cost !== "free_confirmed") return "Custo de API pago ou ainda não confirmado como gratuito.";
  if (policy.permission !== "internal_discovery") return "Coleta automática não liberada para esta origem.";
  if (!policy.reviewedOn || !policy.reviewExpiresOn || now > new Date(`${policy.reviewExpiresOn}T23:59:59Z`)) return "Revisão da fonte vencida ou ausente.";
  return null;
}

export function collectionPolicyForUrl(url: string, now = new Date()): CollectionPolicy {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) throw new Error("radar_url_blocked");
  const policy = Object.values(reviewed).find((entry) => entry.urls.includes(parsed.href));
  if (!policy || collectionBlockReason(policy, now)) throw new Error("radar_collection_blocked");
  return policy;
}

export function listCollectionPolicies(now = new Date()) {
  return [...campaignRadarSourceRegistry.map((source) => ({
    sourceId: source.sourceId, name: source.sourcePlatform, distribution: source.pluginDistribution.status,
  })), { sourceId: "x-search", name: "X", distribution: "blocked" },
  { sourceId: "threads-search", name: "Threads", distribution: "blocked" }].map((source) => {
    const policy = collectionPolicy(source.sourceId);
    return { ...source, ...policy, blockedReason: collectionBlockReason(policy, now) };
  });
}
