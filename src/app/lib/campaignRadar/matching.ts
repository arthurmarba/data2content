import { createHash } from "node:crypto";
import type { CatalogCampaignOpportunity } from "./catalog";
import { inferTerritories } from "./normalization";

export interface CampaignRadarSearchInput {
  query?: string;
  territories?: string[];
  platforms?: string[];
  formats?: string[];
  minimumConfirmedPay?: number;
  deadlineAfter?: string;
  includePrograms?: boolean;
  limit?: number;
}

export type CampaignRadarMatchType = "exact" | "closest" | "market_signal";

export interface RankedCampaignOpportunity {
  opportunity: CatalogCampaignOpportunity;
  matchType: CampaignRadarMatchType;
  reasons: string[];
  unmetCriteria: string[];
  internalScore: number;
}

const STOP_WORDS = new Set([
  "a",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "eu",
  "meu",
  "minha",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "que",
  "se",
  "um",
  "uma",
]);

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return [...new Set(
    normalized(value)
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  )];
}

function normalizedSet(values: string[]): Set<string> {
  return new Set(values.map(normalized).filter(Boolean));
}

function intersection(left: string[], right: string[]): string[] {
  const rightSet = normalizedSet(right);
  return left.filter((value) => rightSet.has(normalized(value)));
}

function opportunityText(opportunity: CatalogCampaignOpportunity): string {
  return [
    opportunity.title,
    opportunity.brand,
    opportunity.summary,
    ...opportunity.territories,
    ...opportunity.platforms,
    ...opportunity.formats,
    ...opportunity.requirements,
    ...opportunity.deliverables,
  ]
    .filter(Boolean)
    .join(" ");
}

export function isConfirmedIndividualPay(opportunity: CatalogCampaignOpportunity): boolean {
  return Boolean(
    opportunity.compensation.confirmed &&
      ["per_creator", "per_delivery"].includes(opportunity.compensation.basis) &&
      opportunity.compensation.minimum != null,
  );
}

function criterionLabel(values: string[]): string {
  return values.length === 1 ? values[0]! : values.join(", ");
}

export function rankCampaignOpportunity(
  opportunity: CatalogCampaignOpportunity,
  input: CampaignRadarSearchInput,
  creatorDescription: string | null,
  privateContentSignals: string[] = [],
): RankedCampaignOpportunity {
  const reasons: string[] = [];
  const unmetCriteria: string[] = [];
  let score = 0;

  const profileTerritories = creatorDescription ? inferTerritories(creatorDescription) : [];
  const matchedProfileTerritories = intersection(profileTerritories, opportunity.territories);
  if (matchedProfileTerritories.length > 0) {
    score += 32;
    reasons.push(`Tem relação com ${criterionLabel(matchedProfileTerritories)}, um dos assuntos do seu perfil.`);
  }

  const profileTokens = creatorDescription ? tokens(creatorDescription) : [];
  const opportunityTokens = new Set(tokens(opportunityText(opportunity)));
  const profileTokenMatches = profileTokens.filter((token) => opportunityTokens.has(token)).slice(0, 3);
  if (profileTokenMatches.length > 0) {
    score += Math.min(18, profileTokenMatches.length * 6);
    if (matchedProfileTerritories.length === 0) {
      reasons.push(`Conversa com temas que você informou: ${profileTokenMatches.join(", ")}.`);
    }
  }

  const privateTerritories = inferTerritories(privateContentSignals.join(" "));
  const matchedPrivateTerritories = intersection(privateTerritories, opportunity.territories);
  const privateTokens = tokens(privateContentSignals.join(" "));
  const privateTokenMatches = privateTokens.filter((token) => opportunityTokens.has(token)).slice(0, 4);
  if (matchedPrivateTerritories.length > 0 || privateTokenMatches.length > 0) {
    score += 26 + Math.min(12, privateTokenMatches.length * 3);
    const labels = matchedPrivateTerritories.length > 0
      ? matchedPrivateTerritories
      : privateTokenMatches;
    reasons.push(
      `Nos seus conteúdos analisados, aparecem sinais ligados a ${criterionLabel(labels)}.`,
    );
  }

  const requestedTerritories = input.territories ?? [];
  if (requestedTerritories.length > 0) {
    const matches = intersection(requestedTerritories, opportunity.territories);
    if (matches.length > 0) {
      score += 30;
      reasons.push(`Está no território de ${criterionLabel(matches)}.`);
    } else {
      unmetCriteria.push(`Não está nos territórios pedidos: ${criterionLabel(requestedTerritories)}.`);
    }
  }

  const requestedPlatforms = input.platforms ?? [];
  if (requestedPlatforms.length > 0) {
    const matches = intersection(requestedPlatforms, opportunity.platforms);
    if (matches.length > 0) {
      score += 12;
      reasons.push(`Aceita conteúdo em ${criterionLabel(matches)}.`);
    } else {
      unmetCriteria.push(`A plataforma pedida não foi confirmada: ${criterionLabel(requestedPlatforms)}.`);
    }
  }

  const requestedFormats = input.formats ?? [];
  if (requestedFormats.length > 0) {
    const matches = intersection(requestedFormats, opportunity.formats);
    if (matches.length > 0) {
      score += 12;
      reasons.push(`Inclui o formato ${criterionLabel(matches)}.`);
    } else {
      unmetCriteria.push(`O formato pedido não foi confirmado: ${criterionLabel(requestedFormats)}.`);
    }
  }

  if (input.minimumConfirmedPay != null) {
    if (
      isConfirmedIndividualPay(opportunity) &&
      (opportunity.compensation.minimum ?? 0) >= input.minimumConfirmedPay
    ) {
      score += 24;
      reasons.push(`O cachê individual mínimo confirmado atende ao valor pedido.`);
    } else {
      unmetCriteria.push(
        `Não há cachê individual mínimo confirmado de R$ ${input.minimumConfirmedPay.toLocaleString("pt-BR")}.`,
      );
    }
  }

  if (input.deadlineAfter) {
    if (opportunity.applicationDeadline && opportunity.applicationDeadline >= input.deadlineAfter) {
      score += 8;
      reasons.push(`O prazo de candidatura atende à data pedida.`);
    } else {
      unmetCriteria.push(`O prazo não atende à data mínima pedida.`);
    }
  }

  const queryTokens = tokens(input.query ?? "");
  if (queryTokens.length > 0) {
    const matchedQueryTokens = queryTokens.filter((token) => opportunityTokens.has(token)).slice(0, 4);
    if (matchedQueryTokens.length > 0) {
      score += Math.min(24, matchedQueryTokens.length * 6);
      reasons.push(`Tem relação com o pedido sobre ${matchedQueryTokens.join(", ")}.`);
    } else {
      unmetCriteria.push(`Não há correspondência clara com todos os temas escritos no pedido.`);
    }
  }

  if (opportunity.applicationDeadline) {
    score += 2;
  }

  const hasRequestedCriteria = Boolean(
    queryTokens.length ||
      requestedTerritories.length ||
      requestedPlatforms.length ||
      requestedFormats.length ||
      input.minimumConfirmedPay != null ||
      input.deadlineAfter,
  );
  const hasProfileSignal =
    matchedProfileTerritories.length > 0 ||
    profileTokenMatches.length > 0 ||
    matchedPrivateTerritories.length > 0 ||
    privateTokenMatches.length > 0;
  const matchType: CampaignRadarMatchType = unmetCriteria.length === 0
    ? "exact"
    : score > 2 || hasProfileSignal || hasRequestedCriteria
      ? "closest"
      : "market_signal";

  if (reasons.length === 0) {
    reasons.push(
      "É uma chamada pública ativa no mercado, mas ainda não há informação suficiente para afirmar que combina com o seu perfil.",
    );
  }

  return { opportunity, matchType, reasons, unmetCriteria, internalScore: score };
}

export function rankCampaignCatalog(
  opportunities: CatalogCampaignOpportunity[],
  input: CampaignRadarSearchInput,
  creatorDescription: string | null,
  privateContentSignals: string[] = [],
): RankedCampaignOpportunity[] {
  return opportunities
    .map((opportunity) =>
      rankCampaignOpportunity(opportunity, input, creatorDescription, privateContentSignals),
    )
    .sort((left, right) =>
      right.internalScore - left.internalScore ||
      (left.opportunity.applicationDeadline ?? "9999-12-31").localeCompare(
        right.opportunity.applicationDeadline ?? "9999-12-31",
      ) ||
      left.opportunity.id.localeCompare(right.opportunity.id),
    );
}

export function campaignRadarWeekKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const localDate = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return localDate.toISOString().slice(0, 10);
}

export function selectWeeklyFreeOpportunity(
  opportunities: CatalogCampaignOpportunity[],
  userId: string,
  creatorDescription: string | null,
  now = new Date(),
): RankedCampaignOpportunity | null {
  if (opportunities.length === 0) return null;
  const rankedForProfile = rankCampaignCatalog(opportunities, {}, creatorDescription).slice(0, 5);
  const weekKey = campaignRadarWeekKey(now);
  return [...rankedForProfile].sort((left, right) => {
    const leftHash = createHash("sha256")
      .update(`${userId}:${weekKey}:${left.opportunity.id}`)
      .digest("hex");
    const rightHash = createHash("sha256")
      .update(`${userId}:${weekKey}:${right.opportunity.id}`)
      .digest("hex");
    return leftHash.localeCompare(rightHash);
  })[0] ?? null;
}
