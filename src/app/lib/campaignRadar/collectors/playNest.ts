import { fetchPublicText, mapWithConcurrency } from "../http";
import {
  compactText,
  dateStatus,
  defaultCompensation,
  htmlToLines,
  parseBrazilianDate,
  stableOpportunityId,
} from "../normalization";
import type { CampaignOpportunity, CampaignSourceCoverage } from "../types";

const SOURCE_ID = "playnest-public-programs";
const SOURCE_PLATFORM = "PlayNest / Play9";
const ACELERA_URL = "https://business.playnest.com.br/acelera-casas-bahia/acelera-cb";
const CONVOCADOS_URL = "https://2026convocados.com.br/";

interface PublicProgramPage {
  url: string;
  parse: (html: string, now: Date) => CampaignOpportunity;
}

export interface PlayNestCollection {
  opportunities: CampaignOpportunity[];
  coverage: CampaignSourceCoverage;
}

function findLink(html: string, labelPattern: RegExp, baseUrl: string): string | null {
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = match[1] ?? "";
    const label = compactText((match[2] ?? "").replace(/<[^>]+>/g, " "), 180);
    if (!labelPattern.test(label)) continue;
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href || href.startsWith("#")) continue;
    return new URL(compactText(href, 600), baseUrl).toString();
  }
  return null;
}

function parseAcelera(html: string, now: Date): CampaignOpportunity {
  const applicationUrl = findLink(html, /^Inscreva-se$/i, ACELERA_URL) ?? ACELERA_URL;
  const lines = htmlToLines(html);
  const pageText = lines.join(" ");
  const hasOpenCall = /Inscreva-se na pr[eé]-sele[cç][aã]o de criadores/i.test(pageText);

  return {
    id: stableOpportunityId(SOURCE_ID, ACELERA_URL, "acelera-cb"),
    sourceId: SOURCE_ID,
    sourcePlatform: SOURCE_PLATFORM,
    sourceUrl: ACELERA_URL,
    applicationUrl,
    applicationLabel: "Inscrever-se na pré-seleção",
    requiresAccount: true,
    title: "Acelera CB - programa de creators Casas Bahia",
    brand: "Casas Bahia",
    summary:
      "Pré-seleção pública para o banco de creators da Casas Bahia, com capacitação e possibilidade de receber convites para campanhas futuras. A inscrição não garante participação.",
    opportunityType: "creator_program",
    territories: ["Lifestyle"],
    platforms: [],
    formats: [],
    requirements: [
      "Enviar dados e conectar redes sociais para análise de perfil.",
      "A pré-seleção não garante participação em campanhas.",
      "Programa apresentado para creators de todas as regiões do Brasil.",
    ],
    deliverables: [],
    compensation: defaultCompensation("Remuneração não informada na página pública do programa."),
    applicationDeadline: null,
    publishedAt: null,
    discoveredAt: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    status: hasOpenCall && applicationUrl !== ACELERA_URL ? "uncertain" : "closed",
    evidence: [
      {
        field: "programa",
        excerpt: "Inscreva-se na pré-seleção de criadores: Acelera CB.",
      },
      {
        field: "limite",
        excerpt: "A inscrição faz parte do processo de pré-seleção e não garante a participação em campanhas.",
      },
    ],
    review: { status: "pending", reviewedAt: null, reviewedBy: null, notes: null },
  };
}

function parseConvocados(html: string, now: Date): CampaignOpportunity {
  const lines = htmlToLines(html);
  const pageText = lines.join(" ");
  const deadlineText = pageText.match(/inscri[cç][oõ]es\s+at[eé]\s+\d{1,2}\/\d{1,2}\/20\d{2}/i)?.[0] ?? "";
  const deadline = parseBrazilianDate(deadlineText);
  const applicationUrl = findLink(html, /inscreva-se agora/i, CONVOCADOS_URL) ?? new URL("/inscricao", CONVOCADOS_URL).toString();

  return {
    id: stableOpportunityId(SOURCE_ID, CONVOCADOS_URL, "2026-convocados"),
    sourceId: SOURCE_ID,
    sourcePlatform: SOURCE_PLATFORM,
    sourceUrl: CONVOCADOS_URL,
    applicationUrl,
    applicationLabel: "Consultar página de inscrição",
    requiresAccount: true,
    title: "2.026 Convocados - comunidade de creators PlayNest + Play9",
    brand: "PlayNest + Play9",
    summary:
      "Seleção nacional de 2.000 creators para comunidade, dinâmicas gamificadas e acesso a convites de campanhas pagas durante o projeto. As inscrições de entrada já encerraram.",
    opportunityType: "creator_program",
    territories: [
      "Entretenimento",
      "Educação",
      "Lifestyle",
      "Tecnologia",
      "Gastronomia",
      "Moda",
      "Maternidade e família",
      "Fitness e saúde",
    ],
    platforms: ["Instagram", "TikTok", "YouTube"],
    formats: [],
    requirements: [
      "Ser maior de 18 anos.",
      "Ter conta ativa em Instagram, TikTok ou YouTube.",
      "Possuir CPF brasileiro válido.",
    ],
    deliverables: [],
    compensation: defaultCompensation("A página confirma campanhas pagas, mas não informa valores."),
    applicationDeadline: deadline,
    publishedAt: null,
    discoveredAt: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    status: dateStatus(deadline, now),
    evidence: [
      { field: "prazo", excerpt: deadlineText || "Prazo não identificado." },
      {
        field: "oportunidade",
        excerpt: "Campanhas exclusivas com marcas e oportunidades de publi para os creators selecionados.",
      },
    ],
    review: { status: "pending", reviewedAt: null, reviewedBy: null, notes: null },
  };
}

const PROGRAM_PAGES: PublicProgramPage[] = [
  { url: ACELERA_URL, parse: parseAcelera },
  { url: CONVOCADOS_URL, parse: parseConvocados },
];

export async function collectPlayNest(params?: { now?: Date }): Promise<PlayNestCollection> {
  const now = params?.now ?? new Date();
  const warnings: string[] = [];
  const parsed = await mapWithConcurrency(PROGRAM_PAGES, 2, async (page) => {
    try {
      return page.parse(await fetchPublicText(page.url), now);
    } catch (error) {
      warnings.push(`${page.url}: ${error instanceof Error ? error.message : "unknown_error"}`);
      return null;
    }
  });
  const opportunities = parsed.filter((item): item is CampaignOpportunity => Boolean(item));

  return {
    opportunities,
    coverage: {
      sourceId: SOURCE_ID,
      sourcePlatform: SOURCE_PLATFORM,
      discoveryUrl: ACELERA_URL,
      fetchedAt: now.toISOString(),
      discoveredDocuments: PROGRAM_PAGES.length,
      emittedOpportunities: opportunities.length,
      warnings,
    },
  };
}

export const playNestCollectorTestUtils = {
  findLink,
  parseAcelera,
  parseConvocados,
};
