export interface ClassificationV25Category {
  id: string;
  label: string;
  description: string;
  keywords?: string[];
  examples?: string[];
  transitional?: boolean;
}

export type ClassificationV25Type = "stance" | "proofStyle" | "commercialMode";

export const stanceCategories: ClassificationV25Category[] = [
  { id: "endorsing", label: "Endossando", description: "Defende, recomenda ou valida explicitamente algo." },
  { id: "questioning", label: "Questionando", description: "Levanta duvidas, perguntas ou tensoes sem fechar uma conclusao forte." },
  { id: "critical", label: "Critico", description: "Critica, contesta ou aponta falhas de forma clara." },
  { id: "comparative", label: "Comparativo", description: "Compara alternativas, lados ou abordagens como postura central." },
  { id: "testimonial", label: "Depoimento", description: "Traz relato proprio, experiencia vivida ou testemunho como postura principal." },
];

export const proofStyleCategories: ClassificationV25Category[] = [
  { id: "demonstration", label: "Demonstracao", description: "Mostra na pratica como algo funciona.", keywords: ["demo", "demonstra", "mostrando na pratica"] },
  { id: "before_after", label: "Antes e Depois", description: "Usa contraste entre estado inicial e resultado final.", keywords: ["antes e depois", "transformacao"] },
  { id: "case_study", label: "Caso/Estudo", description: "Usa caso concreto, cliente, projeto ou resultado como base.", keywords: ["caso", "case", "resultado de cliente"] },
  { id: "social_proof", label: "Prova Social", description: "Usa depoimentos, comentarios, numeros ou validacao de terceiros.", keywords: ["depoimento", "feedback", "print", "avaliacao"] },
  { id: "personal_story", label: "Historia Pessoal", description: "Usa uma experiencia propria ou narrativa pessoal para sustentar a mensagem.", keywords: ["minha historia", "minha experiencia", "aconteceu comigo"] },
  { id: "opinion", label: "Opiniao", description: "Se sustenta principalmente em leitura pessoal, julgamento ou ponto de vista.", keywords: ["minha opiniao", "eu acho", "na minha visao"] },
  { id: "myth_busting", label: "Quebra de Mito", description: "Desmonta crenças comuns, erros ou mitos difundidos.", keywords: ["mito", "mitos", "nao e verdade", "verdade ou mito"] },
  { id: "list_based", label: "Lista", description: "Organiza a prova em lista de itens, pontos ou etapas.", keywords: ["3 dicas", "5 motivos", "lista", "top 5"] },
];

export const commercialModeCategories: ClassificationV25Category[] = [
  { id: "paid_partnership", label: "Parceria Paga", description: "Parceria paga, publi ou conteudo patrocinado.", keywords: ["publi", "#ad", "parceria paga"] },
  { id: "affiliate", label: "Afiliado", description: "Comercializacao com link, codigo ou comissao de afiliado.", keywords: ["afiliado", "link de afiliado", "comissao"] },
  { id: "discount_offer", label: "Oferta/Desconto", description: "Oferta comercial baseada em desconto, cupom ou condicao promocional.", keywords: ["cupom", "desconto", "oferta"] },
  { id: "lead_capture", label: "Captura de Lead", description: "Busca capturar contato ou cadastro antes da conversao.", keywords: ["cadastro", "lista de espera", "material gratuito"] },
  { id: "dm_conversion", label: "Conversao por DM", description: "Leva a pessoa para direct ou mensagem como etapa comercial.", keywords: ["me chama na dm", "mande direct"] },
  { id: "product_launch", label: "Lancamento", description: "Comercializacao organizada em torno de lancamento, abertura de carrinho ou estreia.", keywords: ["lancamento", "abertura de carrinho", "em breve"] },
];

const V25_CATEGORY_MAP: Record<ClassificationV25Type, ClassificationV25Category[]> = {
  stance: stanceCategories,
  proofStyle: proofStyleCategories,
  commercialMode: commercialModeCategories,
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

type V25AliasEntry = {
  category: ClassificationV25Category;
  normalized: string;
};

const V25_DEPRECATED_ALIAS_TARGETS: Partial<Record<ClassificationV25Type, Record<string, string>>> = {
  stance: {
    critico_analitico: "critical",
    analytical: "critical",
    comparative_review: "comparative",
    depoimento: "testimonial",
  },
  proofStyle: {
    beforeafter: "before_after",
    "before after": "before_after",
    case: "case_study",
    socialproof: "social_proof",
    storytime: "personal_story",
    listicle: "list_based",
  },
  commercialMode: {
    sponsored: "paid_partnership",
    publi_divulgation: "paid_partnership",
    promo_offer: "discount_offer",
    dm_cta: "dm_conversion",
    launch: "product_launch",
  },
};

const buildAliasEntries = (type: ClassificationV25Type): V25AliasEntry[] => {
  return V25_CATEGORY_MAP[type]
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

const aliasEntriesByType: Record<ClassificationV25Type, V25AliasEntry[]> = {
  stance: buildAliasEntries("stance"),
  proofStyle: buildAliasEntries("proofStyle"),
  commercialMode: buildAliasEntries("commercialMode"),
};

const deprecatedAliasTargetByType: Partial<Record<ClassificationV25Type, Map<string, string>>> = Object.fromEntries(
  Object.entries(V25_DEPRECATED_ALIAS_TARGETS).map(([type, aliases]) => [
    type,
    new Map(
      Object.entries(aliases || {}).flatMap(([alias, target]) =>
        buildLookupVariants(alias).map((normalized) => [normalized, target] as const)
      )
    ),
  ])
) as Partial<Record<ClassificationV25Type, Map<string, string>>>;

export const V25_CLASSIFICATION_FIELDS = [
  { field: "stance", type: "stance" },
  { field: "proofStyle", type: "proofStyle" },
  { field: "commercialMode", type: "commercialMode" },
] as const;

export type MetricClassificationV25Field = typeof V25_CLASSIFICATION_FIELDS[number]["field"];

export function getV25CategoryById(id: string, type: ClassificationV25Type): ClassificationV25Category | undefined {
  return V25_CATEGORY_MAP[type].find((category) => category.id === id);
}

export function getV25CategoryByValue(value: string, type: ClassificationV25Type): ClassificationV25Category | undefined {
  const candidates = buildLookupVariants(value);
  if (candidates.length === 0) return undefined;

  const deprecatedAliases = deprecatedAliasTargetByType[type];
  for (const candidate of candidates) {
    const deprecatedTarget = deprecatedAliases?.get(candidate);
    if (deprecatedTarget) {
      const category = getV25CategoryById(deprecatedTarget, type);
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

export function toCanonicalV25CategoryId(
  value: string | null | undefined,
  type: ClassificationV25Type
): string | null {
  if (!value) return null;
  return getV25CategoryByValue(value, type)?.id ?? null;
}

export function canonicalizeV25CategoryValues(
  values: unknown,
  type: ClassificationV25Type,
  options?: { includeUnknown?: boolean }
): string[] {
  const rawValues = Array.isArray(values) ? values : typeof values === "string" ? [values] : [];
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") continue;
    const trimmed = rawValue.trim();
    if (!trimmed) continue;

    const canonicalId = toCanonicalV25CategoryId(trimmed, type);
    const nextValue = canonicalId || (options?.includeUnknown ? trimmed : null);
    if (!nextValue || seen.has(nextValue)) continue;

    seen.add(nextValue);
    normalized.push(nextValue);
  }

  return normalized;
}

export function v25IdsToLabels(ids: string[] | undefined, type: ClassificationV25Type): string[] {
  return (ids ?? []).map((id) => getV25CategoryByValue(id, type)?.label ?? id);
}
