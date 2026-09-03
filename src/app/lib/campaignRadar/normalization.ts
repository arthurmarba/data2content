import { createHash } from "node:crypto";
import type {
  CampaignCompensation,
  CampaignOpportunity,
  CampaignOpportunityType,
} from "./types";

const MONTHS: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

const HTML_ENTITIES: Record<string, string> = {
  aacute: "á",
  acirc: "â",
  agrave: "à",
  amp: "&",
  apos: "'",
  atilde: "ã",
  ccedil: "ç",
  eacute: "é",
  ecirc: "ê",
  gt: ">",
  hellip: "...",
  iacute: "í",
  ldquo: '"',
  lsquo: "'",
  lt: "<",
  nbsp: " ",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  quot: '"',
  rdquo: '"',
  rsquo: "'",
  uacute: "ú",
  uuml: "ü",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }
    if (normalized.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }
    return HTML_ENTITIES[normalized] ?? entity;
  });
}

export function compactText(value: string, maxLength = 600): string {
  return decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function htmlToLines(html: string): string[] {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(?:article|div|h[1-6]|li|main|p|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(withoutNoise)
    .split(/\n+/)
    .map((line) => compactText(line, 1_500))
    .filter(Boolean);
}

export function extractFirstTagText(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ? compactText(match[1].replace(/<[^>]+>/g, " "), 240) : null;
}

export function extractMetaContent(html: string, propertyOrName: string): string | null {
  const escaped = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return compactText(value, 600);
  }
  return null;
}

export function parseBrazilianMoney(value: string): number | null {
  const normalized = value
    .replace(/R\$\s*/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseBrazilianDate(value: string): string | null {
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})(?!\d)/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const numeric = value.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (numeric) {
    return `${numeric[3]}-${numeric[2]!.padStart(2, "0")}-${numeric[1]!.padStart(2, "0")}`;
  }

  const textual = value
    .toLocaleLowerCase("pt-BR")
    .match(/\b(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(20\d{2})\b/);
  if (textual) {
    const month = MONTHS[textual[2]!.slice(0, 3)];
    if (month !== undefined) {
      return `${textual[3]}-${String(month + 1).padStart(2, "0")}-${textual[1]!.padStart(2, "0")}`;
    }
  }
  return null;
}

export function dateStatus(deadline: string | null, now = new Date()): "open" | "closed" | "uncertain" {
  if (!deadline) return "uncertain";
  const end = new Date(`${deadline}T23:59:59-03:00`);
  return end.getTime() >= now.getTime() ? "open" : "closed";
}

export function stableOpportunityId(sourceId: string, sourceUrl: string, discriminator: string): string {
  const digest = createHash("sha256")
    .update(`${sourceId}\n${sourceUrl}\n${discriminator}`)
    .digest("hex")
    .slice(0, 16);
  return `${sourceId}:${digest}`;
}

export function defaultCompensation(sourceText: string | null = null): CampaignCompensation {
  return {
    type: "unknown",
    minimum: null,
    maximum: null,
    currency: "BRL",
    basis: "unknown",
    sourceText,
    confirmed: false,
    includesProduct: false,
  };
}

export function inferTerritories(text: string): string[] {
  const normalized = text.toLocaleLowerCase("pt-BR");
  const definitions: Array<[string, RegExp]> = [
    ["Beleza e autocuidado", /beleza|cabelo|hair|skincare|maquiagem|cosm[eé]tico/],
    ["Gastronomia", /gastronomia|alimento|comida|culin[aá]ria|receita|restaurante|varejo/],
    ["Maternidade e família", /maternidade|m[aã]e|pais|fam[ií]lia|beb[eê]|infantil/],
    ["Fitness e saúde", /fitness|sa[uú]de|esporte|corrida|nutri[cç][aã]o|academia/],
    ["Moda", /moda|look|roupa|streetwear|cole[cç][aã]o/],
    ["Tecnologia", /tecnologia|tech|app|software|digital|intelig[eê]ncia artificial/],
    ["Educação", /educa[cç][aã]o|curso|estudo|concurso|ingl[eê]s|universit/],
    ["Viagem", /viagem|turismo|hotel|companhia a[eé]rea|latam/],
    ["Negócios e finanças", /neg[oó]cio|empreendedor|finan[cç]|vendas|lucro|mei/],
    ["Lifestyle", /lifestyle|rotina|dia a dia|bem-estar/],
    ["Entretenimento", /entretenimento|humor|games|cinema|m[uú]sica|document[aá]rio/],
  ];
  return definitions.filter(([, pattern]) => pattern.test(normalized)).map(([label]) => label);
}

export function inferPlatforms(text: string): string[] {
  const normalized = text.toLocaleLowerCase("pt-BR");
  const definitions: Array<[string, RegExp]> = [
    ["Instagram", /instagram|\breels?\b|\bstories?\b/],
    ["TikTok", /tik\s?tok/],
    ["YouTube", /youtube|\bshorts?\b/],
    ["Pinterest", /pinterest/],
    ["Facebook", /facebook/],
    ["LinkedIn", /linkedin/],
  ];
  return definitions.filter(([, pattern]) => pattern.test(normalized)).map(([label]) => label);
}

export function inferFormats(text: string): string[] {
  const normalized = text.toLocaleLowerCase("pt-BR");
  const definitions: Array<[string, RegExp]> = [
    ["Reel", /\breels?\b/],
    ["Stories", /\bstories?\b/],
    ["Carrossel", /carrossel/],
    ["Foto ou feed", /\bfoto(?:s)?\b|\bfeed\b/],
    ["Vídeo", /\bv[ií]deo(?:s)?\b|\bugc\b/],
    ["Live", /\blive(?:s)?\b/],
    ["Short", /\bshorts?\b/],
  ];
  return definitions.filter(([, pattern]) => pattern.test(normalized)).map(([label]) => label);
}

export function dedupeStrings(values: Array<string | null | undefined>, limit = 12): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const normalized = compactText(value, 400);
    const key = normalized.toLocaleLowerCase("pt-BR");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

export function opportunityTypeLabel(type: CampaignOpportunityType): string {
  const labels: Record<CampaignOpportunityType, string> = {
    open_application: "Candidatura aberta",
    creator_program: "Programa de creators",
    invitation_only: "Seleção pela plataforma",
    challenge: "Desafio ou premiação",
    barter: "Permuta",
    ugc: "UGC",
    informational: "Informativo",
    unknown: "Tipo não confirmado",
  };
  return labels[type];
}

export function sortOpportunities(opportunities: CampaignOpportunity[]): CampaignOpportunity[] {
  return [...opportunities].sort((left, right) => {
    const leftDeadline = left.applicationDeadline ?? "9999-12-31";
    const rightDeadline = right.applicationDeadline ?? "9999-12-31";
    return leftDeadline.localeCompare(rightDeadline) || left.title.localeCompare(right.title, "pt-BR");
  });
}
