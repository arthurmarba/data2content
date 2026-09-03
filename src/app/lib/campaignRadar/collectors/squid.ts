import { fetchPublicText, mapWithConcurrency } from "../http";
import {
  compactText,
  defaultCompensation,
  extractFirstTagText,
  extractMetaContent,
  htmlToLines,
  inferTerritories,
  parseBrazilianDate,
  stableOpportunityId,
} from "../normalization";
import type { CampaignOpportunity, CampaignSourceCoverage } from "../types";

const SOURCE_ID = "squid-public-campaigns";
const SOURCE_PLATFORM = "Squid";
const LISTING_URL = "https://vidadeinfluencer.squidit.com.br/campanha/t";

interface ListingEntry {
  title: string;
  url: string;
  publishedAt: string | null;
}

export interface SquidCollection {
  opportunities: CampaignOpportunity[];
  coverage: CampaignSourceCoverage;
}

function slugifyTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/['’]/g, "")
    .replace(/\+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseListingDate(value: string): string | null {
  const match = compactText(value, 80)
    .toLocaleLowerCase("pt-BR")
    .match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.\s*(\d{1,2}),\s*(20\d{2})/);
  if (!match) return null;
  const months: Record<string, string> = {
    jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
    jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  };
  return `${match[3]}-${months[match[1]!]}-${match[2]!.padStart(2, "0")}`;
}

function listingEntries(html: string): ListingEntry[] {
  const entries: ListingEntry[] = [];
  const blocks = html.match(/<article\b[^>]*class=["'][^"']*article-sq[^"']*["'][\s\S]*?<\/article>/gi) ?? [];
  for (const block of blocks) {
    const title = extractFirstTagText(block, "h2");
    if (!title) continue;
    const dateText = block.match(/class=["'][^"']*article-info[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
    entries.push({
      title,
      url: new URL(`/blog/${slugifyTitle(title)}`, LISTING_URL).toString(),
      publishedAt: parseListingDate(dateText.replace(/<[^>]+>/g, " ")),
    });
  }
  return entries;
}

interface ApplicationLink {
  url: string;
  label: string;
}

function findApplicationLinks(html: string): ApplicationLink[] {
  const links: ApplicationLink[] = [];
  const matches = html.matchAll(/<a\b[^>]*href=["'](https?:\/\/app\.(?:wakecreators|squidit)\.com[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const match of matches) {
    const url = match[1]!;
    if (!/\/campaigns?\//i.test(url)) continue;
    const label = compactText(match[2]!.replace(/<[^>]+>/g, " "), 180) || "Acessar candidatura";
    if (!links.some((link) => link.url === url)) links.push({ url, label });
  }
  return links;
}

function parsePublishedAt(html: string): string | null {
  const candidates = [
    html.match(/["']datePublished["']\s*:\s*["']([^"']+)["']/i)?.[1],
    extractMetaContent(html, "article:published_time"),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = parseBrazilianDate(candidate) ?? candidate.match(/20\d{2}-\d{2}-\d{2}/)?.[0] ?? null;
    if (parsed) return parsed;
  }
  return null;
}

function inferBrand(label: string, title: string, summary: string): string | null {
  const labelledKnown = label.match(/\b(Forever Liss|Forever Lovers?|Redken|Matrix|L['’]?Or[eé]al)\b/i)?.[1];
  if (labelledKnown) return compactText(labelledKnown, 70);
  const known = `${title} ${summary}`.match(/\b(Forever Liss|Forever Lovers?|Redken|Matrix|L['’]?Or[eé]al)\b/i)?.[1];
  if (known) return compactText(known, 70);
  const labelled = label.match(/(?:para|de)\s+([\p{L}\d][\p{L}\d '&.-]{1,50}?)(?:\s+(?:no|na|pelo|pela)\s+|$)/iu)?.[1];
  return labelled ? compactText(labelled, 70) : null;
}

function parseArticle(html: string, sourceUrl: string, now: Date, fallbackPublishedAt: string | null): CampaignOpportunity[] {
  const articleTitle = extractFirstTagText(html, "h1") ?? "Campanhas anunciadas pela Squid";
  const lines = htmlToLines(html);
  const publishedAt = parsePublishedAt(html) ?? fallbackPublishedAt;
  const metaSummary = extractMetaContent(html, "description") ?? articleTitle;
  const applicationLinks = findApplicationLinks(html);
  const bodyStart = lines.findIndex((line) => line === articleTitle);
  const articleBody = (bodyStart >= 0 ? lines.slice(bodyStart + 1) : lines).slice(0, 24).join(" ");
  const classificationText = `${articleTitle} ${metaSummary} ${articleBody}`;
  const opportunityType = /workshop|premia[cç][aã]o|concurso|desafio/i.test(classificationText)
    ? "challenge" as const
    : /comunidade\s+forever|programa\s+(?:de\s+)?creator|calend[aá]rio anual|como afiliad/i.test(classificationText)
      ? "creator_program" as const
      : "open_application" as const;

  return applicationLinks.map((link) => {
    const summary = compactText(metaSummary, 420);
    const brand = inferBrand(link.label, articleTitle, summary);
    const compensation = /com cach[eê]|renda extra|monetiz/i.test(`${summary} ${lines.join(" ")}`)
      ? { ...defaultCompensation("A fonte informa que há cachê, mas não divulga o valor."), confirmed: true }
      : defaultCompensation("Valor não divulgado pela fonte pública.");
    const territories = inferTerritories(`${articleTitle} ${summary}`);
    const minimumFollowers = `${summary} ${lines.join(" ")}`.match(/(?:\+|mais de\s*)?([\d.]+)\s*seguidores/i)?.[1];
    const ageRange = `${summary} ${lines.join(" ")}`.match(/(\d{2})\s*a\s*(\d{2})\s*anos/i);
    const requirements = minimumFollowers
      ? [`A fonte menciona ${minimumFollowers} seguidores como critério.`]
      : [];
    if (ageRange) requirements.push(`Faixa etária informada: ${ageRange[1]} a ${ageRange[2]} anos.`);
    const platform = /tiktok/i.test(link.label) ? "TikTok" : /instagram/i.test(link.label) ? "Instagram" : null;
    const itemTitle = brand
      ? `${brand} - ${opportunityType === "creator_program" ? "programa para creators" : "campanha para creators"}${platform ? ` no ${platform}` : ""}`
      : articleTitle;
    return {
      id: stableOpportunityId(SOURCE_ID, sourceUrl, link.url),
      sourceId: SOURCE_ID,
      sourcePlatform: SOURCE_PLATFORM,
      sourceUrl,
      applicationUrl: link.url,
      applicationLabel: link.label,
      requiresAccount: true,
      title: itemTitle,
      brand,
      summary,
      opportunityType,
      territories,
      platforms: platform ? [platform] : [],
      formats: /ugc/i.test(summary) ? ["UGC"] : [],
      requirements,
      deliverables: [],
      compensation,
      applicationDeadline: null,
      publishedAt,
      discoveredAt: now.toISOString(),
      lastVerifiedAt: now.toISOString(),
      status: "uncertain" as const,
      evidence: [
        { field: "oportunidade", excerpt: summary },
        { field: "acao", excerpt: link.label },
      ],
      review: { status: "pending" as const, reviewedAt: null, reviewedBy: null, notes: null },
    };
  });
}

export async function collectSquid(params?: {
  now?: Date;
  maxArticles?: number;
}): Promise<SquidCollection> {
  const now = params?.now ?? new Date();
  const listingHtml = await fetchPublicText(LISTING_URL);
  const discovered = listingEntries(listingHtml);
  const articleLimit = params?.maxArticles ?? 8;
  const selected = discovered.slice(0, articleLimit);
  const warnings: string[] = [];
  // Truncar em silencio esconde campanha da edicao. Hoje a listagem tem menos
  // artigos que o teto, mas se a Squid publicar mais o relatorio precisa dizer.
  if (discovered.length > selected.length) {
    warnings.push(
      `listagem_truncada: ${discovered.length} artigos na fonte, ${selected.length} lidos (limite ${articleLimit}).`,
    );
  }
  const batches = await mapWithConcurrency(selected, 3, async (entry) => {
    try {
      return parseArticle(await fetchPublicText(entry.url), entry.url, now, entry.publishedAt);
    } catch (error) {
      warnings.push(`${entry.url}: ${error instanceof Error ? error.message : "unknown_error"}`);
      return [];
    }
  });
  const opportunities = batches.flat();
  return {
    opportunities,
    coverage: {
      sourceId: SOURCE_ID,
      sourcePlatform: SOURCE_PLATFORM,
      discoveryUrl: LISTING_URL,
      fetchedAt: now.toISOString(),
      discoveredDocuments: discovered.length,
      emittedOpportunities: opportunities.length,
      warnings,
    },
  };
}

export const squidCollectorTestUtils = {
  listingEntries,
  parseArticle,
};
