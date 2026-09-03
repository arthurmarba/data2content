import { fetchPublicText } from "../http";
import { htmlToLines, stableOpportunityId } from "../normalization";
import type { CampaignOpportunity, CampaignSourceCoverage } from "../types";

const ANIMEXTREME_URL = "https://linktr.ee/animextreme";
const ANIMEXTREME_FORM = "https://forms.gle/UKQCouidgrpjsLCYA";
const UPABC_URL = "https://ajuda.upabc.com.br/index.php?catid=16&id=45&view=article";
const UPABC_FORM = "https://www.pulsocriativo.com.br/sys/imprensa/publico/?e=21";
const TIJUCA_URL = "https://www.tijucageekfestival.com.br/";
const TIJUCA_FORM = "https://forms.gle/mDY8BQ7tMNe2FQFBA";

export interface PublicEventCallsCollection {
  opportunities: CampaignOpportunity[];
  coverages: CampaignSourceCoverage[];
}

function pendingReview() {
  return { status: "pending" as const, reviewedAt: null, reviewedBy: null, notes: null };
}

function activeUntil(eventDate: string, now: Date): "open" | "closed" {
  return new Date(`${eventDate}T23:59:59-03:00`).getTime() >= now.getTime() ? "open" : "closed";
}

export function parseAnimextreme(linktreeHtml: string, formHtml: string, now: Date): CampaignOpportunity | null {
  const linktreeText = htmlToLines(linktreeHtml).join(" ");
  const formText = htmlToLines(formHtml).join(" ");
  if (!/Cadastro de Embaixadores e Promotores/i.test(linktreeText)) return null;
  if (!/Vagas Promotores:\s*30/i.test(formText) || !/1 postagem/i.test(formText)) return null;

  return {
    id: stableOpportunityId("animextreme-public-creators", ANIMEXTREME_URL, "promotores-34"),
    sourceId: "animextreme-public-creators",
    sourcePlatform: "Animextreme",
    sourceUrl: ANIMEXTREME_URL,
    applicationUrl: ANIMEXTREME_FORM,
    applicationLabel: "Inscrever-se como embaixador ou promotor",
    requiresAccount: false,
    title: "34º Animextreme — Promotores e Embaixadores",
    brand: "Animextreme",
    summary: "Parceria para creators de cultura geek divulgarem o 34º Animextreme, em Porto Alegre. A modalidade Promotor oferece ingresso comum em troca de uma publicação; Embaixadores concorrem a benefícios ampliados.",
    opportunityType: "barter",
    territories: ["Entretenimento"],
    platforms: ["Instagram", "TikTok", "YouTube", "Twitch"],
    formats: ["Feed", "Reels", "Stories"],
    requirements: [
      "Ter rede social com posts ligados a temas como cosplay, K-pop, games, anime, cultura geek ou streaming.",
      "Evento presencial em Porto Alegre (RS), em 17 e 18 de outubro de 2026.",
    ],
    deliverables: ["Promotores: 1 postagem em data estipulada, usando o card-modelo do evento."],
    compensation: {
      type: "barter",
      minimum: null,
      maximum: null,
      currency: "BRL",
      basis: "per_delivery",
      sourceText: "Promotores recebem 1 ingresso comum para um dia à escolha. O regulamento público prevê benefícios adicionais para Embaixadores.",
      confirmed: true,
      includesProduct: true,
    },
    applicationDeadline: null,
    publishedAt: null,
    discoveredAt: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    status: activeUntil("2026-10-18", now),
    evidence: [
      { field: "vagas", excerpt: "15 vagas para Embaixadores e 30 vagas para Promotores." },
      { field: "contrapartida", excerpt: "1 postagem em data estipulada usando o card template; em troca, 1 ingresso comum." },
    ],
    review: pendingReview(),
  };
}

export function parseUpAbc(helpHtml: string, formHtml: string, now: Date): CampaignOpportunity | null {
  const helpText = htmlToLines(helpHtml).join(" ");
  const formText = htmlToLines(formHtml).join(" ");
  if (!/Credenciamento para Cobertura do Up!ABC/i.test(helpText)) return null;
  if (!/100 fotos por dia de cobertura/i.test(formText) || !/<form\b/i.test(formHtml)) return null;

  return {
    id: stableOpportunityId("upabc-public-coverage", UPABC_URL, "festival-2026"),
    sourceId: "upabc-public-coverage",
    sourcePlatform: "Up!ABC",
    sourceUrl: UPABC_URL,
    applicationUrl: UPABC_FORM,
    applicationLabel: "Solicitar credencial de cobertura",
    requiresAccount: false,
    title: "Festival Up!ABC — parceria de cobertura para creators",
    brand: "Up!ABC",
    summary: "Credenciamento público para fotógrafos, cinegrafistas, jornalistas e perfis de cultura nerd/geek cobrirem os dois dias do Festival Up!ABC. A parceria oferece acesso gratuito para até três integrantes e exige a entrega do material bruto.",
    opportunityType: "barter",
    territories: ["Entretenimento"],
    platforms: [],
    formats: ["Fotografia", "Vídeo", "Matéria"],
    requirements: [
      "Perfil público, ativo e alinhado a cultura nerd, geek, games, cinema ou cosplay.",
      "Fotógrafos, cinegrafistas, jornalistas ou redatores; cosplayers usam outro credenciamento.",
      "Evento presencial em São Paulo, em 19 e 20 de setembro de 2026.",
    ],
    deliverables: [
      "Fotógrafos: mínimo de 100 fotos por dia de cobertura.",
      "Enviar fotos e/ou vídeos brutos, sem marca d'água, em até 15 dias após o festival.",
    ],
    compensation: {
      type: "barter",
      minimum: null,
      maximum: null,
      currency: "BRL",
      basis: "per_delivery",
      sourceText: "Entrada gratuita nos dois dias para até 3 integrantes da equipe; não há cachê informado.",
      confirmed: true,
      includesProduct: false,
    },
    applicationDeadline: null,
    publishedAt: "2026-07-15",
    discoveredAt: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    status: activeUntil("2026-09-20", now),
    evidence: [
      { field: "benefício", excerpt: "Acesso gratuito aos dois dias do festival para até três integrantes." },
      { field: "entrega", excerpt: "Mínimo de 100 fotos por dia para fotógrafos; material bruto em até 15 dias." },
    ],
    review: pendingReview(),
  };
}

export function parseTijucaGeek(html: string, now: Date): CampaignOpportunity | null {
  const text = htmlToLines(html).join(" ");
  if (!/CREDENCIAMENTO DE IMPRENSA E INFLUENCIADORES/i.test(text)) return null;
  if (!/produzir e publicar conteudo sobre o evento/i.test(text)) return null;
  if (!html.includes(TIJUCA_FORM)) return null;

  return {
    id: stableOpportunityId("tijuca-geek-public-coverage", TIJUCA_URL, "festival-2026"),
    sourceId: "tijuca-geek-public-coverage",
    sourcePlatform: "Tijuca Geek Festival",
    sourceUrl: TIJUCA_URL,
    applicationUrl: TIJUCA_FORM,
    applicationLabel: "Solicitar credenciamento",
    requiresAccount: true,
    title: "Tijuca Geek Festival — credenciamento de influencers",
    brand: "Tijuca Geek Festival",
    summary: "Credenciamento de creators para produzir e publicar conteúdo sobre o evento no Rio de Janeiro. Os benefícios variam conforme o alcance, de ingresso e credencial a acompanhante e press kit premium.",
    opportunityType: "barter",
    territories: ["Entretenimento"],
    platforms: ["Instagram"],
    formats: ["Cobertura de evento", "Foto", "Vídeo"],
    requirements: [
      "Idade mínima de 17 anos e pelo menos 500 seguidores.",
      "Conta pública no Instagram; perfis privados são recusados.",
      "Evento presencial no Rio de Janeiro, em 13 de setembro de 2026.",
    ],
    deliverables: ["Produzir e publicar conteúdo sobre o evento conforme orientações da produção."],
    compensation: {
      type: "barter",
      minimum: null,
      maximum: null,
      currency: "BRL",
      basis: "per_delivery",
      sourceText: "Acesso gratuito e benefícios por faixa de seguidores; não há cachê informado.",
      confirmed: true,
      includesProduct: true,
    },
    applicationDeadline: null,
    publishedAt: null,
    discoveredAt: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    status: activeUntil("2026-09-13", now),
    evidence: [
      { field: "elegibilidade", excerpt: "Mínimo de 500 seguidores, 17 anos e conta pública no Instagram." },
      { field: "benefícios", excerpt: "Acesso gratuito; kits e acompanhante variam conforme a faixa de seguidores." },
    ],
    review: pendingReview(),
  };
}

export async function collectPublicEventCalls(params?: { now?: Date }): Promise<PublicEventCallsCollection> {
  const now = params?.now ?? new Date();
  const requests = [ANIMEXTREME_URL, ANIMEXTREME_FORM, UPABC_URL, UPABC_FORM, TIJUCA_URL];
  const warnings = new Map<string, string[]>();
  const pages = await Promise.all(
    requests.map(async (url) => {
      try {
        return await fetchPublicText(url);
      } catch (error) {
        warnings.set(url, [error instanceof Error ? error.message : String(error)]);
        return "";
      }
    }),
  );

  const parsed = [
    parseAnimextreme(pages[0]!, pages[1]!, now),
    parseUpAbc(pages[2]!, pages[3]!, now),
    parseTijucaGeek(pages[4]!, now),
  ].filter((item): item is CampaignOpportunity => item !== null);

  const sourceDefinitions = [
    { id: "animextreme-public-creators", platform: "Animextreme", url: ANIMEXTREME_URL, requestUrls: requests.slice(0, 2) },
    { id: "upabc-public-coverage", platform: "Up!ABC", url: UPABC_URL, requestUrls: requests.slice(2, 4) },
    { id: "tijuca-geek-public-coverage", platform: "Tijuca Geek Festival", url: TIJUCA_URL, requestUrls: requests.slice(4, 5) },
  ];

  return {
    opportunities: parsed,
    coverages: sourceDefinitions.map((source) => ({
      sourceId: source.id,
      sourcePlatform: source.platform,
      discoveryUrl: source.url,
      fetchedAt: now.toISOString(),
      discoveredDocuments: source.requestUrls.filter((url) => !warnings.has(url)).length,
      emittedOpportunities: parsed.filter((item) => item.sourceId === source.id).length,
      warnings: source.requestUrls.flatMap((url) => warnings.get(url) ?? []),
    })),
  };
}

export const publicEventCallsCollectorTestUtils = {
  parseAnimextreme,
  parseUpAbc,
  parseTijucaGeek,
};
