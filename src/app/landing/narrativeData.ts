import type { LandingCreatorHighlight } from "@/types/landing";

export const FALLBACK_LANDING_CREATORS: LandingCreatorHighlight[] = [
  {
    id: "rafa-belli",
    name: "Rafa Belli",
    username: "rafabelli",
    avatarUrl: "/images/Rafa Belli Foto D2C.png",
    hasAvatarImage: true,
    totalInteractions: 0,
    postCount: 0,
    avgInteractionsPerPost: 0,
    avgReachPerPost: 0,
    rank: 1,
  },
  {
    id: "livia-linhares",
    name: "Lívia Linhares",
    username: "livialinharess",
    avatarUrl: "/images/Livia Foto D2C.png",
    hasAvatarImage: true,
    totalInteractions: 0,
    postCount: 0,
    avgInteractionsPerPost: 0,
    avgReachPerPost: 0,
    rank: 2,
  },
];

function creatorIdentity(creator: LandingCreatorHighlight) {
  return (creator.username || creator.id).replace(/^@/, "").trim().toLocaleLowerCase("pt-BR");
}

export function selectLandingCreatorProofs(
  creators: LandingCreatorHighlight[] | null | undefined,
  limit = 8,
) {
  const selected: LandingCreatorHighlight[] = [];
  const seen = new Set<string>();

  const add = (creator: LandingCreatorHighlight) => {
    if (!creator.avatarUrl || creator.hasAvatarImage === false) return;
    const identity = creatorIdentity(creator);
    if (!identity || seen.has(identity) || selected.length >= limit) return;
    seen.add(identity);
    selected.push(creator);
  };

  (creators ?? []).forEach(add);
  FALLBACK_LANDING_CREATORS.forEach(add);

  return selected;
}

export const PRODUCT_MOMENTS = {
  mapa: {
    index: "01",
    label: "Seu Mapa",
    title: "Entenda o que já torna seu conteúdo reconhecível.",
    body: "A conversa da reunião encontra continuidade: a D2C organiza assuntos, situações reais e formas de comunicação que já fazem parte de você.",
  },
  pautas: {
    index: "02",
    label: "Pautas",
    title: "Escolha ideias que realmente poderiam ser suas.",
    body: "As pautas transformam a direção discutida ao vivo em caminhos concretos para você criar durante a semana.",
  },
  analise: {
    index: "03",
    label: "Análise",
    title: "Publique entendendo melhor o que está construindo.",
    body: "Antes de postar, compare o vídeo com seu Mapa e entenda se ele fortalece, expande ou inaugura uma narrativa.",
  },
} as const;

export type ProductMoment = keyof typeof PRODUCT_MOMENTS;

export const MAP_GROUPS = [
  {
    label: "Assuntos",
    tone: "amber",
    items: ["Autonomia criativa", "Negócios criativos", "Inteligência artificial"],
  },
  {
    label: "Situações reais",
    tone: "rose",
    items: ["criar sem copiar fórmulas", "bastidores de quem constrói", "vida a dois"],
  },
  {
    label: "Como você fala",
    tone: "violet",
    items: ["Direto e didático", "Pessoal", "Provocativo"],
  },
] as const;

export const MATCH_STORY = {
  ideaTitle: "Como comecei a defender a liberdade de criar com a minha cara",
  ideaBody: "Uma pauta sobre autonomia criativa, identidade e o momento em que copiar fórmulas deixou de fazer sentido.",
  ideaHook: "Abre com a primeira vez em que você percebeu que uma fórmula podia apagar a sua voz.",
  collabTitle: "Duas perspectivas sobre criar sem copiar fórmulas",
  collabBody: "Encontramos alguém que também se reconheceu nessa pauta. As histórias são diferentes — a vontade de criar é a mesma.",
  collabDirection: "Cada creator conta o momento em que decidiu proteger o próprio jeito de criar.",
} as const;

export const BUSINESS_PILLARS = [
  { icon: "video", title: "Crie com intenção", body: "Mapa, pautas e análise para decidir o que vale a pena construir." },
  { icon: "users", title: "Conecte narrativas", body: "Matches de collab e comunidade para transformar afinidade em criação." },
  { icon: "chart", title: "Aprenda com os resultados", body: "Os dados retornam ao sistema e tornam as próximas leituras mais próximas de você." },
  { icon: "briefcase", title: "Apresente seu valor", body: "Media Kit, precificação e propostas para transformar conteúdo em negócio." },
] as const;
