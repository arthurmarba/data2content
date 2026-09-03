import type { McpAccountState } from "./accountState";
import {
  getOrAssignWeeklyFreeOpportunity,
  listPublicCampaignRadarCatalog,
} from "@/app/lib/campaignRadar/repository";
import {
  isConfirmedIndividualPay,
  rankCampaignCatalog,
  rankCampaignOpportunity,
  type CampaignRadarSearchInput,
  type RankedCampaignOpportunity,
} from "@/app/lib/campaignRadar/matching";

const FREE_ACCESS_NOTICE =
  "Sua conta permite consultar uma publicidade selecionada por semana no ChatGPT. " +
  "Outras publicidades não estão disponíveis para esta conta no momento. " +
  "Você pode conferir as informações da sua conta na plataforma Data2Content.";

function maxAgeDays(): number {
  const parsed = Number.parseInt(process.env.CAMPAIGN_RADAR_MAX_AGE_DAYS ?? "8", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : 8;
}

function compensationLabel(match: RankedCampaignOpportunity): string {
  const compensation = match.opportunity.compensation;
  if (isConfirmedIndividualPay(match.opportunity)) {
    return compensation.sourceText || "Cachê individual confirmado na fonte";
  }
  if (compensation.type === "barter" || compensation.includesProduct) {
    return compensation.sourceText || "Permuta ou produto, sem cachê individual confirmado";
  }
  if (compensation.basis === "per_sale" || compensation.type === "variable") {
    return compensation.sourceText || "Remuneração variável, sem valor mínimo confirmado";
  }
  return "Cachê individual não informado ou não confirmado pela fonte";
}

function plainMatchLabel(match: RankedCampaignOpportunity): string {
  if (match.matchType === "exact") return "Atende aos critérios informados";
  if (match.matchType === "closest") return "É a opção mais próxima encontrada";
  return "Sinal do que está acontecendo no mercado";
}

function publicOpportunity(match: RankedCampaignOpportunity) {
  const compensation = match.opportunity.compensation;
  const individualPayConfirmed = isConfirmedIndividualPay(match.opportunity);
  return {
    title: match.opportunity.title,
    brand: match.opportunity.brand,
    summary: match.opportunity.summary,
    opportunityType: match.opportunity.opportunityType,
    territories: match.opportunity.territories,
    platforms: match.opportunity.platforms,
    formats: match.opportunity.formats,
    requirements: match.opportunity.requirements,
    deliverables: match.opportunity.deliverables,
    compensation: {
      label: compensationLabel(match),
      individualPayConfirmed,
      minimum: individualPayConfirmed ? compensation.minimum : null,
      maximum: individualPayConfirmed ? compensation.maximum : null,
      currency: "BRL" as const,
    },
    applicationDeadline: match.opportunity.applicationDeadline,
    sourcePlatform: match.opportunity.sourcePlatform,
    sourceUrl: match.opportunity.sourceUrl,
    application: {
      url: match.opportunity.applicationUrl,
      label: match.opportunity.applicationLabel,
      requiresAccount: match.opportunity.requiresAccount,
    },
    fit: {
      type: match.matchType,
      label: plainMatchLabel(match),
      reasons: match.reasons,
      unmetCriteria: match.unmetCriteria,
      acceptanceIsNotGuaranteed: true as const,
    },
    lastVerifiedAt: match.opportunity.lastVerifiedAt,
  };
}

export interface FindMcpCampaignOpportunitiesParams {
  userId: string;
  accountState: McpAccountState;
  search: CampaignRadarSearchInput;
  privateContentSignals?: string[];
  now?: Date;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function appendStrings(target: string[], value: unknown) {
  if (typeof value === "string" && value.trim()) {
    target.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) appendStrings(target, item);
    return;
  }
  const object = record(value);
  if (!object) return;
  for (const item of Object.values(object)) appendStrings(target, item);
}

export function extractCampaignRadarPrivateSignals(snapshot: unknown): string[] {
  const root = record(snapshot);
  if (!root) return [];
  const strategy = record(root.strategy);
  const performanceLearning = record(root.performanceLearning);
  const creatorVoice = record(root.creatorVoice);
  const dnaProfile = record(creatorVoice?.dnaProfile);
  const candidates: string[] = [];

  appendStrings(candidates, strategy?.resolvedCategories);
  appendStrings(candidates, strategy?.rankedCategories);
  const captionEvidence = Array.isArray(performanceLearning?.captionEvidence)
    ? performanceLearning.captionEvidence
    : [];
  for (const evidence of captionEvidence) {
    appendStrings(candidates, record(evidence)?.categories);
  }
  appendStrings(candidates, dnaProfile?.recurringExpressions);

  const seen = new Set<string>();
  return candidates.filter((value) => {
    const normalized = value.toLocaleLowerCase("pt-BR");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, 40);
}

export async function findMcpCampaignOpportunities({
  userId,
  accountState,
  search,
  privateContentSignals = [],
  now = new Date(),
}: FindMcpCampaignOpportunitiesParams) {
  const usablePrivateSignals = accountState.capabilities.privateCreatorIntelligence
    ? privateContentSignals.filter((value) => value.trim()).slice(0, 40)
    : [];
  const instagramSignalsUsed = usablePrivateSignals.length > 0;
  const personalization = {
    basis: instagramSignalsUsed
      ? "declared_profile_and_instagram_content" as const
      : "declared_profile" as const,
    instagramConnected: accountState.instagramConnected,
    instagramSignalsUsed,
  };
  const catalog = await listPublicCampaignRadarCatalog({
    includePrograms: Boolean(search.includePrograms && accountState.accessLevel === "pro"),
    now,
    maxAgeDays: maxAgeDays(),
  });

  const creatorDescription = accountState.creatorNorth;
  if (catalog.length === 0) {
    return {
      schemaVersion: "campaign_opportunities_v1" as const,
      access: accountState.accessLevel === "free" ? "weekly_selection" as const : "full_catalog" as const,
      message:
        "Não encontrei uma publicidade pública, ativa e revisada para mostrar agora. " +
        "As chamadas mudam e expiram; tente novamente em outro momento.",
      ...(accountState.accessLevel === "free" ? { accountNotice: FREE_ACCESS_NOTICE } : {}),
      personalization,
      opportunities: [],
    };
  }

  if (accountState.accessLevel === "free") {
    const assignment = await getOrAssignWeeklyFreeOpportunity({
      opportunities: catalog,
      userId,
      creatorDescription,
      now,
    });
    const evaluated = assignment.opportunity
      ? rankCampaignOpportunity(assignment.opportunity, search, creatorDescription)
      : null;
    return {
      schemaVersion: "campaign_opportunities_v1" as const,
      access: "weekly_selection" as const,
      weekStartsOn: assignment.weekStartsOn,
      message: evaluated
        ? "Esta é a oportunidade de publicidade selecionada para você nesta semana. A relação considera as " +
          "informações que você contou sobre quem é, o que publica, para quem cria e o que deseja gerar."
        : assignment.assignedOpportunityUnavailable
          ? "A oportunidade selecionada para esta semana deixou de estar disponível. Para proteger você de um link vencido ou retirado pela fonte, não vou substituí-la por outra antes da próxima semana."
          : "Não há uma oportunidade de publicidade selecionada para esta semana.",
      accountNotice: FREE_ACCESS_NOTICE,
      personalization,
      opportunities: evaluated ? [publicOpportunity(evaluated)] : [],
    };
  }

  const ranked = rankCampaignCatalog(
    catalog,
    search,
    creatorDescription,
    usablePrivateSignals,
  );
  const exact = ranked.filter((item) => item.matchType === "exact");
  const limit = Math.max(1, Math.min(10, search.limit ?? 5));
  const selected = (exact.length > 0 ? exact : ranked.slice(0, 1)).slice(0, limit);
  const message = exact.length > 0
    ? "Encontrei publicidades ativas que atendem aos critérios informados." +
      (instagramSignalsUsed
        ? " A relação também considerou sinais dos seus conteúdos analisados."
        : "")
    : "Não encontrei uma publicidade que atenda a todos os critérios. Mostrei a opção mais próxima " +
      "e deixei claro o que ela não atende.";

  return {
    schemaVersion: "campaign_opportunities_v1" as const,
    access: "full_catalog" as const,
    message,
    personalization,
    opportunities: selected.map(publicOpportunity),
    coverage: {
      activePublicCatalog: catalog.length,
      exactMatches: exact.length,
      returned: selected.length,
      hasMore: exact.length > selected.length,
    },
  };
}
