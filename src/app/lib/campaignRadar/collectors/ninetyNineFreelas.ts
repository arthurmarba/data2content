import { fetchPublicText } from "../http";
import {
  compactText,
  decodeHtmlEntities,
  dedupeStrings,
  inferTerritories,
  stableOpportunityId,
} from "../normalization";
import type { CampaignOpportunity, CampaignSourceCoverage } from "../types";

const SOURCE_ID = "ninety-nine-freelas-public";
const SOURCE_PLATFORM = "99Freelas";
const BASE_URL = "https://www.99freelas.com.br";
const SEARCH_TERMS = ["ugc", "influenciador", "creator de conteúdo"];

interface PublicProject {
  url: string;
  title: string;
  description: string;
  publishedAt: string | null;
  deadline: string | null;
}

export interface NinetyNineFreelasCollection {
  opportunities: CampaignOpportunity[];
  coverage: CampaignSourceCoverage;
}

function saoPauloDate(timestamp: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function attributeValue(attributes: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return attributes.match(new RegExp(`\\b${escaped}=["']([^"']+)["']`, "i"))?.[1] ?? null;
}

function projectBlocks(html: string): string[] {
  return Array.from(
    html.matchAll(/<li\b[^>]*class=["'][^"']*\bresult-item\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi),
    (match) => match[0],
  );
}

function timestampFromClass(block: string, className: string): number | null {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = block.match(new RegExp(`<[^>]+class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>`, "i"))?.[0];
  if (!tag) return null;
  const raw = attributeValue(tag, "cp-datetime");
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePublicProjects(html: string, now = new Date()): PublicProject[] {
  const projects: PublicProject[] = [];
  for (const block of projectBlocks(html)) {
    const link = block.match(/<a\b[^>]*href=["'](\/project\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link?.[1] || !link[2]) continue;

    const descriptionHtml = block.match(/\bdata-content=["']([^"']*)["']/i)?.[1] ?? "";
    const description = compactText(
      decodeHtmlEntities(descriptionHtml).replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, " "),
      2_500,
    );
    const published = timestampFromClass(block, "datetime");
    const deadline = timestampFromClass(block, "datetime-restante");
    if (deadline !== null && deadline < now.getTime()) continue;

    projects.push({
      url: new URL(link[1].replace(/\?fs=t(?:&|$)/, "?"), BASE_URL).toString().replace(/\?$/, ""),
      title: compactText(link[2].replace(/<[^>]+>/g, " "), 180),
      description,
      publishedAt: published === null ? null : saoPauloDate(published),
      deadline: deadline === null ? null : saoPauloDate(deadline),
    });
  }
  return projects;
}

function isCreatorProject(project: PublicProject): boolean {
  const text = `${project.title} ${project.description}`;
  const creatorSignal = /\b(?:ugc|creator|criador(?:a|es)? de conte[uú]do|influenciador(?:a|es)?|atriz|ator|apresentador(?:a)?)\b/i.test(text);
  const productionSignal = /\b(?:gravar|grava[cç][aã]o|produzir|produ[cç][aã]o|aparecer|diante da c[aâ]mera|depoimento|roteiro|v[ií]deos?|reels?|tiktok)\b/i.test(text);
  const editingOnly = /\b(?:editor|edi[cç][aã]o|gest[aã]o|assistente|social media)\b/i.test(project.title)
    && !/\b(?:gravar|grava[cç][aã]o|aparecer|diante da c[aâ]mera|depoimento)\b/i.test(text);
  const creatorHiringProductionTeam = /\bsou (?:uma? )?(?:influenciador(?:a)?|creator|youtuber)\b/i.test(project.description)
    && /\bbusco (?:um |uma )?(?:profissional|editor|social media|videomaker)\b/i.test(project.description);
  return creatorSignal && productionSignal && !editingOnly && !creatorHiringProductionTeam;
}

function platforms(text: string): string[] {
  return dedupeStrings([
    /instagram|reels?/i.test(text) ? "Instagram" : null,
    /tiktok/i.test(text) ? "TikTok" : null,
    /facebook|meta ads/i.test(text) ? "Facebook" : null,
    /youtube|shorts?/i.test(text) ? "YouTube" : null,
    /whatsapp/i.test(text) ? "WhatsApp" : null,
  ]);
}

function formats(text: string): string[] {
  return dedupeStrings([
    /\bugc\b/i.test(text) ? "UGC" : null,
    /vertical|9:16/i.test(text) ? "Vídeo vertical" : null,
    /depoimento/i.test(text) ? "Depoimento" : null,
    /reels?/i.test(text) ? "Reels" : null,
    /stories?/i.test(text) ? "Stories" : null,
  ]);
}

function deliverables(text: string): string[] {
  return dedupeStrings(
    Array.from(
      text.matchAll(/\b\d+\s+(?:v[ií]deos?|reels?|stories?|fotos?)(?:\s+[^.;\n]{0,90})?/gi),
      (match) => compactText(match[0], 120),
    ),
    6,
  );
}

function opportunityFromProject(project: PublicProject, now: Date): CampaignOpportunity {
  const text = `${project.title} ${project.description}`;
  return {
    id: stableOpportunityId(SOURCE_ID, project.url, project.url),
    sourceId: SOURCE_ID,
    sourcePlatform: SOURCE_PLATFORM,
    sourceUrl: project.url,
    applicationUrl: project.url,
    applicationLabel: "Enviar proposta no 99Freelas",
    requiresAccount: true,
    title: project.title,
    brand: null,
    summary: compactText(project.description, 520),
    opportunityType: "ugc",
    territories: inferTerritories(text),
    platforms: platforms(text),
    formats: formats(text),
    requirements: [],
    deliverables: deliverables(project.description),
    compensation: {
      type: "variable",
      minimum: null,
      maximum: null,
      currency: "BRL",
      basis: "per_delivery",
      sourceText: "Orçamento aberto: o creator deve enviar sua proposta. O piso de R$ 50 exibido pelo site é da plataforma, não um cachê confirmado.",
      confirmed: false,
      includesProduct: /produto (?:ser[aá] )?enviado|enviaremos o produto/i.test(text),
    },
    applicationDeadline: project.deadline,
    publishedAt: project.publishedAt,
    discoveredAt: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    status: "open",
    evidence: [
      { field: "descrição pública", excerpt: compactText(project.description, 420) },
      { field: "remuneração", excerpt: "Orçamento aberto; propostas são negociadas dentro da plataforma." },
    ],
    review: { status: "pending", reviewedAt: null, reviewedBy: null, notes: null },
  };
}

export async function collectNinetyNineFreelas(params?: { now?: Date }): Promise<NinetyNineFreelasCollection> {
  const now = params?.now ?? new Date();
  const searchUrls = SEARCH_TERMS.map((term) => `${BASE_URL}/projects?q=${encodeURIComponent(term)}`);
  const warnings: string[] = [];
  const pages = await Promise.all(
    searchUrls.map(async (url) => {
      try {
        return await fetchPublicText(url);
      } catch (error) {
        warnings.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
        return "";
      }
    }),
  );

  const byFingerprint = new Map<string, PublicProject>();
  for (const html of pages) {
    for (const project of parsePublicProjects(html, now)) {
      if (!isCreatorProject(project)) continue;
      const fingerprint = compactText(`${project.title} ${project.description}`, 1_200).toLocaleLowerCase("pt-BR");
      if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, project);
    }
  }
  const opportunities = Array.from(byFingerprint.values()).map((project) => opportunityFromProject(project, now));

  return {
    opportunities,
    coverage: {
      sourceId: SOURCE_ID,
      sourcePlatform: SOURCE_PLATFORM,
      discoveryUrl: `${BASE_URL}/projects?q=ugc`,
      fetchedAt: now.toISOString(),
      discoveredDocuments: pages.filter(Boolean).length,
      emittedOpportunities: opportunities.length,
      warnings,
    },
  };
}

export const ninetyNineFreelasCollectorTestUtils = {
  parsePublicProjects,
  isCreatorProject,
  opportunityFromProject,
};
