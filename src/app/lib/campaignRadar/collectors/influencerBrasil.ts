import { fetchPublicText, mapWithConcurrency } from "../http";
import {
  compactText,
  dateStatus,
  dedupeStrings,
  defaultCompensation,
  extractFirstTagText,
  extractMetaContent,
  htmlToLines,
  inferTerritories,
  parseBrazilianDate,
  parseBrazilianMoney,
  stableOpportunityId,
} from "../normalization";
import type {
  CampaignCompensation,
  CampaignOpportunity,
  CampaignSourceCoverage,
} from "../types";

const SOURCE_ID = "influencer-brasil";
const SOURCE_PLATFORM = "Influencer Brasil";
const SITEMAP_URL = "https://influencerbrasil.com.br/sitemap-projects.xml";

interface ProjectUrl {
  url: string;
  lastModified: string | null;
}

export interface InfluencerBrasilCollection {
  opportunities: CampaignOpportunity[];
  coverage: CampaignSourceCoverage;
}

function parseProjectUrls(xml: string): ProjectUrl[] {
  const entries: ProjectUrl[] = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/gi) ?? [];
  for (const block of blocks) {
    const url = block.match(/<loc>([^<]+)<\/loc>/i)?.[1]?.trim();
    if (!url || !/\/projeto\/[^/]+\/?$/i.test(url)) continue;
    const lastModified = block.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1]?.trim() ?? null;
    entries.push({ url, lastModified });
  }
  return entries;
}

function lineAfter(lines: string[], label: string): string | null {
  const index = lines.findIndex((line) => line.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR"));
  return index >= 0 ? lines[index + 1] ?? null : null;
}

function sectionLines(lines: string[], startLabels: string[], endLabels: string[], max = 8): string[] {
  const normalizedStart = startLabels.map((value) => value.toLocaleLowerCase("pt-BR"));
  const normalizedEnd = endLabels.map((value) => value.toLocaleLowerCase("pt-BR"));
  const candidates: string[][] = [];
  for (let startIndex = 0; startIndex < lines.length; startIndex += 1) {
    if (!normalizedStart.includes(lines[startIndex]!.toLocaleLowerCase("pt-BR"))) continue;
    const values: string[] = [];
    for (let index = startIndex + 1; index < lines.length && values.length < max; index += 1) {
      const line = lines[index]!;
      if (normalizedEnd.includes(line.toLocaleLowerCase("pt-BR"))) break;
      if (line.length >= 4 && !/^\d+$/.test(line)) values.push(line);
    }
    candidates.push(values);
  }
  return candidates.sort((left, right) => right.length - left.length)[0] ?? [];
}

function parseListField(description: string, start: string, end: string): string[] {
  const pattern = new RegExp(`${start}:\\s*(.*?)\\.\\s*${end}:`, "i");
  const value = description.match(pattern)?.[1];
  if (!value) return [];
  return dedupeStrings(value.split(/,|\se\s/).map((item) => item.trim()), 8);
}

function parseDeadline(description: string, lines: string[]): string | null {
  const descriptionPeriod = description.match(/Per[ií]odo:\s*([^.]*)/i)?.[1] ?? "";
  const dates = descriptionPeriod.match(/20\d{2}-\d{2}-\d{2}/g) ?? [];
  if (dates.length > 0) return dates.at(-1) ?? null;

  const labelledDeadline = lineAfter(lines, "Prazo");
  if (labelledDeadline) {
    const labelledDates = labelledDeadline.match(
      /(?:\d{1,2}\/\d{1,2}\/20\d{2}|20\d{2}-\d{2}-\d{2})/g,
    );
    if (labelledDates?.length) return parseBrazilianDate(labelledDates.at(-1)!) ?? labelledDates.at(-1)!;
  }

  const periodLine = lines.find(
    (line) => /(?:per[ií]odo|prazo)/i.test(line) && /(?:\d{1,2}\/\d{1,2}\/20\d{2}|20\d{2}-\d{2}-\d{2})/.test(line),
  );
  if (periodLine) {
    const periodDates = periodLine.match(/(?:\d{1,2}\/\d{1,2}\/20\d{2}|20\d{2}-\d{2}-\d{2})/g);
    if (periodDates?.length) return parseBrazilianDate(periodDates.at(-1)!) ?? periodDates.at(-1)!;
  }

  const deadlineLine = lines.find((line) => /candidaturas?.*(?:at[eé]|abertas)/i.test(line));
  return deadlineLine ? parseBrazilianDate(deadlineLine) : null;
}

function parseCompensation(lines: string[], description: string): CampaignCompensation {
  const joined = lines.join(" \n ");
  const explicitRange = joined.match(
    /(?:cada creator[^.]{0,140}?(?:receber[aá]|ganhar[aá])|cach[eê][^.]{0,80}?)(?:[^R]{0,80})R\$\s*([\d.,]+)\s*(?:a|at[eé]|e|-)\s*R?\$?\s*([\d.,]+)/i,
  );
  if (explicitRange) {
    const minimum = parseBrazilianMoney(explicitRange[1]!);
    const maximum = parseBrazilianMoney(explicitRange[2]!);
    return {
      type: "range",
      minimum,
      maximum,
      currency: "BRL",
      basis: "per_creator",
      sourceText: compactText(explicitRange[0], 240),
      confirmed: minimum !== null && maximum !== null,
      includesProduct: /pe[cç]a|produto|kit|recebid/i.test(joined),
    };
  }

  const explicitFixed = joined.match(
    /(?:cada creator[^.]{0,140}?(?:receber[aá]|ganhar[aá])|cach[eê][^.]{0,80}?)(?:[^R]{0,80})R\$\s*([\d.,]+)/i,
  );
  if (explicitFixed) {
    const amount = parseBrazilianMoney(explicitFixed[1]!);
    return {
      type: "fixed",
      minimum: amount,
      maximum: amount,
      currency: "BRL",
      basis: "per_creator",
      sourceText: compactText(explicitFixed[0], 240),
      confirmed: amount !== null,
      includesProduct: /pe[cç]a|produto|kit|recebid/i.test(joined),
    };
  }

  const commission = joined.match(/comiss[aã]o\s+de\s+([\d.,]+)%[^.]{0,180}/i);
  if (commission) {
    return {
      type: "variable",
      minimum: null,
      maximum: null,
      currency: "BRL",
      basis: "per_sale",
      sourceText: compactText(commission[0], 240),
      confirmed: true,
      includesProduct: false,
    };
  }

  if (/permuta|produto enviado|receber[aá] (?:uma|um) (?:pe[cç]a|produto|kit)/i.test(joined)) {
    return {
      type: "barter",
      minimum: null,
      maximum: null,
      currency: "BRL",
      basis: "unknown",
      sourceText: "Produto ou benefício informado pela fonte; cachê individual não confirmado.",
      confirmed: true,
      includesProduct: true,
    };
  }

  const investmentLine =
    description.match(/Faixa de investimento:\s*([^.]*)/i)?.[1] ??
    lines.find((line) => /^(?:Orçamento|Esta campanha trabalha com uma faixa de investimento).*R\$/i.test(line));
  const investment = investmentLine
    ?.replace(/^Orçamento\s*/i, "")
    .match(/^(?:Esta campanha trabalha com uma faixa de investimento de\s*)?(.*?)(?:,\s*com execu[cç][aã]o|\.\s|$)/i)?.[1];
  if (investment) {
    const amounts = [...investment.matchAll(/R\$\s*([\d.,]+)/gi)]
      .map((match) => parseBrazilianMoney(match[1]!))
      .filter((amount): amount is number => amount !== null);
    const isUpperBound = /(?:at[eé])\s+R\$/i.test(investment);
    const isLowerBound = /a partir de/i.test(investment);
    return {
      ...defaultCompensation(compactText(investment, 120)),
      minimum: isUpperBound ? null : amounts[0] ?? null,
      maximum: isLowerBound ? null : amounts.at(-1) ?? null,
      basis: "total_campaign_budget",
    };
  }
  return defaultCompensation();
}

function parseRequirements(lines: string[]): string[] {
  const requirements = sectionLines(
    lines,
    ["Quem estamos procurando", "Quem deve se candidatar"],
    ["Entrega da campanha", "Categorias", "Materiais de apoio", "Formatos"],
    10,
  );
  return dedupeStrings(
    requirements.filter((line) =>
      /seguidor|conte[uú]do|perfil|creator|resid|idade|anos|regi[aã]o|estado|cidade|tiktok|instagram|youtube/i.test(
        line,
      ),
    ),
    6,
  );
}

function parseDeliverables(lines: string[]): string[] {
  const candidates = [
    ...sectionLines(
      lines,
      ["O que você vai fazer", "Entrega da campanha"],
      ["Quem estamos procurando", "Cachê + peça", "Categorias", "O estilo que combina com a gente"],
      10,
    ),
    ...lines.filter((line) => /entrega inicial desejada|\b\d+\s+(?:v[ií]deo|reel|story|stories|post|short)/i.test(line)),
  ];
  return dedupeStrings(
    candidates
      .filter((line) => /v[ií]deo|reel|story|stories|post|short|carrossel|live|publica/i.test(line))
      .map((line) => line.replace(/^\d+\s+(?=\d+\s+)/, "")),
    4,
  );
}

function parseOpportunity(html: string, project: ProjectUrl, now: Date): CampaignOpportunity {
  const lines = htmlToLines(html);
  const title = extractFirstTagText(html, "h1") ?? "Oportunidade sem título";
  const description =
    extractMetaContent(html, "description") ?? lines.find((line) => line.startsWith(`${title}.`)) ?? title;
  const categories = parseListField(description, "Categorias", "Plataformas");
  const platforms = parseListField(description, "Plataformas", "Formatos");
  const formats = parseListField(description, "Formatos", "Idiomas");
  const deadline = parseDeadline(description, lines);
  const compensation = parseCompensation(lines, description);
  const requirements = parseRequirements(lines);
  const deliverables = parseDeliverables(lines);
  const summaryLines = sectionLines(
    lines,
    ["O que a marca está buscando", "Resumo da oportunidade"],
    ["Categorias", "O que você vai fazer", "Faixa de investimento e cronograma"],
    4,
  );
  const summary = compactText(
    summaryLines
      .filter((line) => !/^(?:o que a marca est[aá] buscando|resumo da oportunidade)$/i.test(line))
      .join(" ") || description,
    520,
  );
  const territories = dedupeStrings([...categories, ...inferTerritories(`${title} ${summary}`)], 8);
  const publishedAt = project.lastModified ? project.lastModified.slice(0, 10) : null;
  const evidence = [
    { field: "resumo", excerpt: compactText(description, 500) },
    ...(compensation.sourceText
      ? [{ field: "remuneracao", excerpt: compactText(compensation.sourceText, 300) }]
      : []),
    ...(requirements[0] ? [{ field: "elegibilidade", excerpt: requirements[0] }] : []),
    ...(deliverables[0] ? [{ field: "entrega", excerpt: deliverables[0] }] : []),
  ];

  return {
    id: stableOpportunityId(SOURCE_ID, project.url, title),
    sourceId: SOURCE_ID,
    sourcePlatform: SOURCE_PLATFORM,
    sourceUrl: project.url,
    applicationUrl: project.url,
    applicationLabel: "Ver oportunidade e candidatar-se",
    requiresAccount: true,
    title,
    brand: /\bmarca\b/i.test(title) ? null : title.split(/[—|-]/)[0]?.trim() || null,
    summary,
    opportunityType: "open_application",
    territories,
    platforms,
    formats,
    requirements,
    deliverables,
    compensation,
    applicationDeadline: deadline,
    publishedAt,
    discoveredAt: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    status: dateStatus(deadline, now),
    evidence,
    review: { status: "pending", reviewedAt: null, reviewedBy: null, notes: null },
  };
}

export async function collectInfluencerBrasil(params?: {
  now?: Date;
  maxProjects?: number;
}): Promise<InfluencerBrasilCollection> {
  const now = params?.now ?? new Date();
  const xml = await fetchPublicText(SITEMAP_URL);
  const discovered = parseProjectUrls(xml);
  const projects = params?.maxProjects ? discovered.slice(0, params.maxProjects) : discovered;
  const warnings: string[] = [];
  if (discovered.length > projects.length) {
    warnings.push(
      `listagem_truncada: ${discovered.length} projetos na fonte, ${projects.length} lidos (limite ${params?.maxProjects}).`,
    );
  }
  const parsed = await mapWithConcurrency(projects, 4, async (project) => {
    try {
      return parseOpportunity(await fetchPublicText(project.url), project, now);
    } catch (error) {
      warnings.push(`${project.url}: ${error instanceof Error ? error.message : "unknown_error"}`);
      return null;
    }
  });
  const opportunities = parsed.filter((value): value is CampaignOpportunity => Boolean(value));
  return {
    opportunities,
    coverage: {
      sourceId: SOURCE_ID,
      sourcePlatform: SOURCE_PLATFORM,
      discoveryUrl: SITEMAP_URL,
      fetchedAt: now.toISOString(),
      discoveredDocuments: discovered.length,
      emittedOpportunities: opportunities.length,
      warnings,
    },
  };
}

export const influencerBrasilCollectorTestUtils = {
  parseOpportunity,
  parseProjectUrls,
};
