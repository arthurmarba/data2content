import { fetchPublicText } from "../http";
import {
  compactText,
  defaultCompensation,
  stableOpportunityId,
} from "../normalization";
import type { CampaignOpportunity, CampaignSourceCoverage } from "../types";

const SOURCE_ID = "creator-ads-public-calls";
const SOURCE_PLATFORM = "Creator Ads";
const LISTING_URL = "https://linktr.ee/creatorads.br";

interface PublicCallLink {
  title: string;
  url: string;
}

export interface CreatorAdsCollection {
  opportunities: CampaignOpportunity[];
  coverage: CampaignSourceCoverage;
}

function attributeValue(attributes: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return attributes.match(new RegExp(`\\b${escaped}=["']([^"']+)["']`, "i"))?.[1] ?? null;
}

function publicCallLinks(html: string): PublicCallLink[] {
  const links: PublicCallLink[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const attributes = match[1] ?? "";
    if (attributeValue(attributes, "data-testid") !== "LinkClickTriggerLink") continue;
    const title = compactText(attributeValue(attributes, "aria-label") ?? "", 180);
    const url = compactText(attributeValue(attributes, "href") ?? "", 500);
    if (!title || !/^https?:\/\//i.test(url)) continue;
    if (!/\bcampanha\b|\bsele[cç][aã]o\b/i.test(title)) continue;
    if (/sxsw|vote|treinamento|curso|central de ajuda/i.test(title)) continue;
    if (!links.some((link) => link.url === url)) links.push({ title, url });
  }
  return links;
}

// Slugs que a Creator Ads usa para cadastro geral, nao para uma marca.
const GENERIC_SLUGS = /^(pg\d+|cadastro|signup|link|geral|brasil|instagram|tiktok|home)$/i;

const BRAND_LABELS: Record<string, string> = {
  cocacola: "Coca-Cola",
  betmgm: "BetMGM",
  pantene: "Pantene",
};

/** O slug do link curto ("/cocacola-linktree") identifica a marca melhor que o
 * texto do botao: nao depende de a marca aparecer escrita, e vale para marcas
 * novas sem precisar mexer no codigo. */
export function brandSlug(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const slug = pathname.replace(/^\/+|\/+$/g, "").replace(/-linktree$/i, "").toLowerCase();
  if (!slug || GENERIC_SLUGS.test(slug)) return null;
  return slug;
}

function inferBrand(url: string, title: string): string | null {
  const slug = brandSlug(url);
  if (slug) {
    const known = BRAND_LABELS[slug.replace(/[^a-z0-9]/g, "")];
    if (known) return known;
    // Marca desconhecida: so aceita slug de palavra unica, para nao inventar
    // marca a partir de um slug de campanha ("homens-nordeste-agosto").
    if (/^[a-z0-9]{3,}$/.test(slug)) return slug[0]!.toUpperCase() + slug.slice(1);
  }
  const knownInTitle = title.match(/\b(Coca[‐‑‒–—-]?Cola|Bet\s*MGM|Pantene)\b/i)?.[1];
  if (!knownInTitle) return null;
  if (/coca/i.test(knownInTitle)) return "Coca-Cola";
  if (/bet/i.test(knownInTitle)) return "BetMGM";
  return "Pantene";
}

function titleForCall(linkTitle: string, brand: string | null): string {
  if (brand) return `${brand} - seleção pública de creators`;
  if (/homens.*nordeste/i.test(linkTitle)) return "Campanha para creators homens do Nordeste";
  return compactText(linkTitle.replace(/[,!]+\s*(?:se cadastra|cadastre-se).*$/i, ""), 140);
}

function opportunityFromLink(link: PublicCallLink, now: Date): CampaignOpportunity {
  const brand = inferBrand(link.url, link.title);
  // Sem slug de marca, o botao leva ao cadastro geral da plataforma: a chamada
  // e real, mas nada no destino confirma a campanha anunciada.
  const genericDestination = brandSlug(link.url) === null;
  const regionalRequirement = /homens.*nordeste/i.test(link.title)
    ? ["Chamada direcionada a creators homens da região Nordeste."]
    : [];
  // Na Creator Ads a candidatura e um cadastro na selecao: quem e escolhido
  // recebe a campanha por e-mail. Nao ha briefing nem valor na vitrine publica.
  const mechanic =
    "Você se cadastra na seleção e, se for escolhido, recebe a campanha por e-mail. "
    + "Valor, briefing e prazo não são divulgados na vitrine pública.";
  const summary = brand
    ? `Seleção pública da Creator Ads para creators em campanha de ${brand}. ${mechanic}`
    : `Seleção pública da Creator Ads para creators. ${mechanic}`;

  return {
    id: stableOpportunityId(SOURCE_ID, LISTING_URL, link.url),
    sourceId: SOURCE_ID,
    sourcePlatform: SOURCE_PLATFORM,
    sourceUrl: LISTING_URL,
    applicationUrl: link.url,
    applicationLabel: "Cadastrar-se na seleção",
    requiresAccount: true,
    title: titleForCall(link.title, brand),
    brand,
    summary,
    opportunityType: "open_application",
    territories: [],
    platforms: [],
    formats: [],
    requirements: regionalRequirement,
    deliverables: [],
    compensation: defaultCompensation("Valor não divulgado na chamada pública."),
    applicationDeadline: null,
    publishedAt: null,
    discoveredAt: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    status: "uncertain",
    evidence: [
      { field: "chamada", excerpt: link.title },
      { field: "candidatura", excerpt: link.url },
      {
        field: "destino",
        excerpt: genericDestination
          ? "O link abre o cadastro da seleção da Creator Ads, sem página própria desta campanha."
          : `O link abre a página de cadastro da seleção desta campanha (${brandSlug(link.url)}).`,
      },
    ],
    review: { status: "pending", reviewedAt: null, reviewedBy: null, notes: null },
  };
}

export async function collectCreatorAds(params?: { now?: Date }): Promise<CreatorAdsCollection> {
  const now = params?.now ?? new Date();
  const html = await fetchPublicText(LISTING_URL);
  const links = publicCallLinks(html);
  const opportunities = links.map((link) => opportunityFromLink(link, now));

  return {
    opportunities,
    coverage: {
      sourceId: SOURCE_ID,
      sourcePlatform: SOURCE_PLATFORM,
      discoveryUrl: LISTING_URL,
      fetchedAt: now.toISOString(),
      discoveredDocuments: 1,
      emittedOpportunities: opportunities.length,
      warnings: [],
    },
  };
}

export const creatorAdsCollectorTestUtils = {
  publicCallLinks,
  opportunityFromLink,
  brandSlug,
};
