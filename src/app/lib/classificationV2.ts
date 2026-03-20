export interface ClassificationV2Category {
  id: string;
  label: string;
  description: string;
  keywords?: string[];
  examples?: string[];
  transitional?: boolean;
}

export type ClassificationV2Type = "contentIntent" | "narrativeForm" | "contentSignal";

export const contentIntentCategories: ClassificationV2Category[] = [
  { id: "announce", label: "Anunciar/Lançar", description: "Comunica uma novidade, lancamento, agenda ou mudanca relevante." },
  { id: "teach", label: "Ensinar", description: "Tem objetivo principal de ensinar algo pratico ou transferir conhecimento." },
  { id: "inform", label: "Informar/Atualizar", description: "Atualiza, noticia ou contextualiza um fato sem foco principal em ensino." },
  { id: "entertain", label: "Entreter", description: "Busca divertir, entreter ou prender pela leveza e performance." },
  { id: "inspire", label: "Inspirar/Motivar", description: "Busca inspirar, encorajar ou provocar reflexao positiva." },
  { id: "build_authority", label: "Construir Autoridade", description: "Posiciona o criador como referencia, especialista ou voz forte em um tema." },
  { id: "convert", label: "Converter", description: "Tem objetivo principal de gerar acao comercial, lead ou decisao de compra." },
  { id: "connect", label: "Conectar/Relacionar", description: "Fortalece proximidade, pertencimento ou identificacao com a audiencia." },
];

export const narrativeFormCategories: ClassificationV2Category[] = [
  { id: "behind_the_scenes", label: "Bastidores", description: "Mostra o processo, os bastidores ou o making of." },
  { id: "clip", label: "Clipe/Corte", description: "Trecho curto extraido ou destacado de um conteudo maior." },
  { id: "comparison", label: "Comparacao", description: "Organiza a narrativa comparando opcoes, ideias ou produtos." },
  { id: "day_in_the_life", label: "Rotina/Vlog", description: "Mostra o dia a dia, rotina, estilo de vida ou acompanhamento pessoal." },
  { id: "guest_appearance", label: "Participacao/Collab", description: "Conteudo estruturado em participacao, colaboracao ou presenca de convidado." },
  { id: "news_update", label: "Atualizacao/Noticia", description: "Atualizacao curta, informativa, de fatos, novidades ou acontecimentos." },
  { id: "q_and_a", label: "Perguntas e Respostas", description: "Narrativa estruturada a partir de perguntas da audiencia." },
  { id: "reaction", label: "Reaction", description: "Reage a outro conteudo, noticia, opiniao ou situacao." },
  { id: "review", label: "Review", description: "Avalia um produto, servico, experiencia ou obra." },
  { id: "sketch_scene", label: "Cena/Esquete", description: "Executa uma cena, esquete ou performance de humor." },
  { id: "tutorial", label: "Tutorial/Passo a Passo", description: "Ensina por demonstracao, passo a passo ou lista de instrucoes." },
  { id: "unboxing", label: "Unboxing", description: "Mostra a abertura inicial de um produto e a primeira impressao." },
];

export const contentSignalCategories: ClassificationV2Category[] = [
  { id: "comment_cta", label: "CTA de Comentario", description: "Pede explicitamente para comentar ou responder algo." },
  { id: "save_cta", label: "CTA de Salvamento", description: "Pede explicitamente para salvar o conteudo." },
  { id: "share_cta", label: "CTA de Compartilhamento", description: "Pede explicitamente para compartilhar o conteudo." },
  { id: "link_in_bio_cta", label: "CTA de Link na Bio", description: "Direciona a pessoa para o link da bio." },
  { id: "dm_cta", label: "CTA de DM", description: "Direciona a pessoa para enviar mensagem direta." },
  { id: "sponsored", label: "Patrocinado/Publi", description: "Sinaliza parceria paga, publi ou promocao patrocinada." },
  { id: "giveaway", label: "Sorteio", description: "Sinaliza mecanica de sorteio ou giveaway.", transitional: true },
  { id: "trend_participation", label: "Participacao em Trend", description: "Sinaliza adesao a meme, trend, challenge ou viral do momento." },
  { id: "collab", label: "Colaboracao", description: "Sinaliza colaboracao, feat ou participacao de terceiros." },
  { id: "promo_offer", label: "Oferta/Promocao", description: "Sinaliza oferta, desconto, cupom ou empurrao comercial." },
];

const V2_CATEGORY_MAP: Record<ClassificationV2Type, ClassificationV2Category[]> = {
  contentIntent: contentIntentCategories,
  narrativeForm: narrativeFormCategories,
  contentSignal: contentSignalCategories,
};

const normalizeLookupKey = (value?: string | null) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[_./\\|:>#~\[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const buildLookupVariants = (value?: string | null): string[] => {
  if (!value) return [];
  const trimmed = String(value).trim();
  if (!trimmed) return [];

  const variants = new Set<string>();
  const push = (candidate?: string | null) => {
    const normalized = normalizeLookupKey(candidate);
    if (normalized) variants.add(normalized);
  };

  push(trimmed);
  push(trimmed.replace(/\s*\([^)]*\)\s*/g, " ").trim());

  return Array.from(variants);
};

type V2AliasEntry = {
  category: ClassificationV2Category;
  normalized: string;
};

const V2_DEPRECATED_ALIAS_TARGETS: Partial<Record<ClassificationV2Type, Record<string, string>>> = {
  contentIntent: {
    authority: "build_authority",
    educational: "teach",
    informational: "inform",
    inspirational: "inspire",
    promotional: "convert",
  },
  narrativeForm: {
    life_style: "day_in_the_life",
    lifestyle: "day_in_the_life",
    humor_scene: "sketch_scene",
    news: "news_update",
    "q&a": "q_and_a",
    tips: "tutorial",
  },
  contentSignal: {
    publi_divulgation: "sponsored",
    trend: "trend_participation",
  },
};

const buildAliasEntries = (type: ClassificationV2Type): V2AliasEntry[] => {
  return V2_CATEGORY_MAP[type]
    .flatMap((category) => {
      const candidates = new Set<string>([category.id, category.label, ...(category.keywords ?? [])]);
      return Array.from(candidates).flatMap((candidate) =>
        buildLookupVariants(candidate).map((normalized) => ({
          category,
          normalized,
        }))
      );
    })
    .sort((left, right) => right.normalized.length - left.normalized.length);
};

const aliasEntriesByType: Record<ClassificationV2Type, V2AliasEntry[]> = {
  contentIntent: buildAliasEntries("contentIntent"),
  narrativeForm: buildAliasEntries("narrativeForm"),
  contentSignal: buildAliasEntries("contentSignal"),
};

const deprecatedAliasTargetByType: Partial<Record<ClassificationV2Type, Map<string, string>>> = Object.fromEntries(
  Object.entries(V2_DEPRECATED_ALIAS_TARGETS).map(([type, aliases]) => [
    type,
    new Map(
      Object.entries(aliases || {}).flatMap(([alias, target]) =>
        buildLookupVariants(alias).map((normalized) => [normalized, target] as const)
      )
    ),
  ])
) as Partial<Record<ClassificationV2Type, Map<string, string>>>;

export const V2_CLASSIFICATION_FIELDS = [
  { field: "contentIntent", type: "contentIntent" },
  { field: "narrativeForm", type: "narrativeForm" },
  { field: "contentSignals", type: "contentSignal" },
] as const;

export type MetricClassificationV2Field = typeof V2_CLASSIFICATION_FIELDS[number]["field"];

export function getV2CategoryById(id: string, type: ClassificationV2Type): ClassificationV2Category | undefined {
  return V2_CATEGORY_MAP[type].find((category) => category.id === id);
}

export function getV2CategoryByValue(value: string, type: ClassificationV2Type): ClassificationV2Category | undefined {
  const candidates = buildLookupVariants(value);
  if (candidates.length === 0) return undefined;

  const deprecatedAliases = deprecatedAliasTargetByType[type];
  for (const candidate of candidates) {
    const deprecatedTarget = deprecatedAliases?.get(candidate);
    if (deprecatedTarget) {
      const category = getV2CategoryById(deprecatedTarget, type);
      if (category) return category;
    }
  }

  const entries = aliasEntriesByType[type];
  for (const candidate of candidates) {
    const exact = entries.find((entry) => entry.normalized === candidate);
    if (exact) return exact.category;
  }

  return undefined;
}

export function toCanonicalV2CategoryId(value: string | null | undefined, type: ClassificationV2Type): string | null {
  if (!value) return null;
  return getV2CategoryByValue(value, type)?.id ?? null;
}

export function canonicalizeV2CategoryValues(
  values: unknown,
  type: ClassificationV2Type,
  options?: { includeUnknown?: boolean }
): string[] {
  const rawValues = Array.isArray(values) ? values : typeof values === "string" ? [values] : [];
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") continue;
    const trimmed = rawValue.trim();
    if (!trimmed) continue;

    const canonicalId = toCanonicalV2CategoryId(trimmed, type);
    const nextValue = canonicalId || (options?.includeUnknown ? trimmed : null);
    if (!nextValue || seen.has(nextValue)) continue;

    seen.add(nextValue);
    normalized.push(nextValue);
  }

  return normalized;
}

export function v2IdsToLabels(ids: string[] | undefined, type: ClassificationV2Type): string[] {
  return (ids ?? []).map((id) => getV2CategoryByValue(id, type)?.label ?? id);
}
