import {
  formatCategories,
  proposalCategories,
  contextCategories,
  toneCategories,
  referenceCategories,
  canonicalizeCategoryValues,
  sanitizeLegacyProposalValues,
  type Category,
} from "@/app/lib/classification";
import {
  canonicalizeV2CategoryValues,
  contentIntentCategories,
  contentSignalCategories,
  narrativeFormCategories,
  type ClassificationV2Category,
} from "@/app/lib/classificationV2";
import {
  canonicalizeV25CategoryValues,
  commercialModeCategories,
  proofStyleCategories,
  stanceCategories,
  type ClassificationV25Category,
} from "@/app/lib/classificationV2_5";

export interface ClassificationResult {
  format: string[];
  proposal: string[];
  context: string[];
  tone: string[];
  references: string[];
  contentIntent: string[];
  narrativeForm: string[];
  contentSignals: string[];
  stance: string[];
  proofStyle: string[];
  commercialMode: string[];
}

export interface MetricClassificationSeed {
  source?: string | null;
  type?: string | null;
  description?: string | null;
}

export interface MetricClassificationUpdateData extends ClassificationResult {}

const EMPTY_CLASSIFICATION_RESULT: ClassificationResult = {
  format: [],
  proposal: [],
  context: [],
  tone: [],
  references: [],
  contentIntent: [],
  narrativeForm: [],
  contentSignals: [],
  stance: [],
  proofStyle: [],
  commercialMode: [],
};

const PROPOSAL_TO_CONTENT_INTENT: Partial<Record<string, string[]>> = {
  announcement: ["announce"],
  behind_the_scenes: ["connect"],
  comparison: ["teach"],
  giveaway: ["convert"],
  humor_scene: ["entertain"],
  lifestyle: ["connect"],
  message_motivational: ["inspire"],
  news: ["inform"],
  participation: ["connect"],
  positioning_authority: ["build_authority"],
  publi_divulgation: ["convert"],
  "q&a": ["connect"],
  react: ["entertain"],
  review: ["inform"],
  tips: ["teach"],
  trend: ["entertain"],
  unboxing: ["inform"],
};

const PROPOSAL_TO_NARRATIVE_FORM: Partial<Record<string, string[]>> = {
  behind_the_scenes: ["behind_the_scenes"],
  clip: ["clip"],
  comparison: ["comparison"],
  humor_scene: ["sketch_scene"],
  lifestyle: ["day_in_the_life"],
  news: ["news_update"],
  participation: ["guest_appearance"],
  "q&a": ["q_and_a"],
  react: ["reaction"],
  review: ["review"],
  tips: ["tutorial"],
  unboxing: ["unboxing"],
};

const PROPOSAL_TO_CONTENT_SIGNALS: Partial<Record<string, string[]>> = {
  giveaway: ["giveaway"],
  participation: ["collab"],
  publi_divulgation: ["sponsored"],
  trend: ["trend_participation"],
};

const TONE_TO_CONTENT_INTENT: Partial<Record<string, string[]>> = {
  humorous: ["entertain"],
  inspirational: ["inspire"],
  educational: ["teach"],
  critical: ["build_authority"],
  promotional: ["convert"],
  neutral: ["inform"],
};

const PROPOSAL_TO_STANCE: Partial<Record<string, string[]>> = {
  comparison: ["comparative"],
  review: ["testimonial"],
};

const TONE_TO_STANCE: Partial<Record<string, string[]>> = {
  critical: ["critical"],
};

const RESULT_KEY_MAPPING: { [K in keyof ClassificationResult]: string[] } = {
  format: ["format", "formato", "formato do conteudo", "formato do conteúdo"],
  proposal: ["proposal", "proposta"],
  context: ["context", "contexto"],
  tone: ["tone", "tom"],
  references: ["references", "reference", "referencias", "referências"],
  contentIntent: [
    "content intent",
    "content_intent",
    "contentintent",
    "intent",
    "intencao",
    "intenção",
    "objetivo",
    "objetivo principal",
  ],
  narrativeForm: [
    "narrative form",
    "narrative_form",
    "narrativeform",
    "formato narrativo",
    "forma narrativa",
    "narrativa",
  ],
  contentSignals: [
    "content signals",
    "content_signals",
    "contentsignals",
    "signals",
    "signal",
    "sinais",
    "sinais do conteudo",
    "sinais do conteúdo",
  ],
  stance: ["stance", "postura", "posicionamento", "stance do conteudo"],
  proofStyle: ["proof style", "proof_style", "estilo de prova", "tipo de prova", "prova"],
  commercialMode: [
    "commercial mode",
    "commercial_mode",
    "modo comercial",
    "mecanica comercial",
    "mecanica de conversao",
  ],
};

const SIGNAL_PATTERNS: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: "comment_cta",
    patterns: [
      /\bcomenta(r| aqui)?\b/u,
      /\bcomentem\b/u,
      /\bdeixa nos comentarios\b/u,
      /\bdeixe nos comentarios\b/u,
      /\bme conta\b/u,
      /\bme contem\b/u,
      /\bresponde aqui\b/u,
      /\bresponda aqui\b/u,
    ],
  },
  {
    id: "save_cta",
    patterns: [
      /\bsalva esse post\b/u,
      /\bsalva pra depois\b/u,
      /\bsalve esse post\b/u,
      /\bsalve pra depois\b/u,
      /\bguarda esse post\b/u,
      /\bfavorita\b/u,
    ],
  },
  {
    id: "share_cta",
    patterns: [
      /\bcompartilha\b/u,
      /\bcompartilhe\b/u,
      /\benvia pra\b/u,
      /\benvie pra\b/u,
      /\bmanda pra\b/u,
      /\bmande pra\b/u,
    ],
  },
  {
    id: "link_in_bio_cta",
    patterns: [/\blink na bio\b/u, /\blink da bio\b/u],
  },
  {
    id: "dm_cta",
    patterns: [
      /\bmanda dm\b/u,
      /\bme manda dm\b/u,
      /\bme chama na dm\b/u,
      /\bme chama no direct\b/u,
      /\bchama no direct\b/u,
      /\bme manda direct\b/u,
      /\bmanda direct\b/u,
    ],
  },
  {
    id: "sponsored",
    patterns: [
      /#publi\b/u,
      /#ad\b/u,
      /\bpubli\b/u,
      /\bpublipost\b/u,
      /\bparceria paga\b/u,
      /\bpatrocinad[oa]\b/u,
      /\bconteudo patrocinado\b/u,
    ],
  },
  {
    id: "giveaway",
    patterns: [/\bsorteio\b/u, /\bgiveaway\b/u],
  },
  {
    id: "trend_participation",
    patterns: [/\btrend\b/u, /\bchallenge\b/u, /\bviral\b/u, /\bmeme\b/u],
  },
  {
    id: "collab",
    patterns: [
      /\bcollab\b/u,
      /\bfeat\b/u,
      /\bfeaturing\b/u,
      /\bparticipacao especial\b/u,
      /\bparticipação especial\b/u,
      /\bcom convidad[oa]\b/u,
    ],
  },
  {
    id: "promo_offer",
    patterns: [
      /\bdesconto\b/u,
      /\bcupom\b/u,
      /\boferta\b/u,
      /\bpromocao\b/u,
      /\bpromoção\b/u,
      /\bfrete gratis\b/u,
      /\bfrete grátis\b/u,
      /\baproveita\b/u,
    ],
  },
];

const STANCE_PATTERNS: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: "endorsing",
    patterns: [
      /\brecomendo\b/u,
      /\bindico\b/u,
      /\bvale muito a pena\b/u,
      /\bamei\b/u,
      /\badorei\b/u,
      /\bfuncionou pra mim\b/u,
    ],
  },
  {
    id: "questioning",
    patterns: [
      /\bsera que\b/u,
      /\bserá que\b/u,
      /\bduvida\b/u,
      /\bdúvida\b/u,
      /\bnao sei se\b/u,
      /\bnão sei se\b/u,
    ],
  },
  {
    id: "testimonial",
    patterns: [
      /\bminha experiencia\b/u,
      /\bminha experiência\b/u,
      /\baconteceu comigo\b/u,
      /\beu testei\b/u,
      /\beu usei\b/u,
      /\bdepoimento\b/u,
    ],
  },
];

const PROOF_STYLE_PATTERNS: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: "before_after",
    patterns: [/\bantes e depois\b/u, /\bantes\/depois\b/u, /\btransformacao\b/u, /\btransformação\b/u],
  },
  {
    id: "case_study",
    patterns: [/\bcase\b/u, /\bestudo de caso\b/u, /\bcaso real\b/u, /\bresultado de cliente\b/u],
  },
  {
    id: "social_proof",
    patterns: [/\bfeedback\b/u, /\bavaliacao\b/u, /\bavaliação\b/u, /\bdepoimento\b/u, /\bprint\b/u],
  },
  {
    id: "personal_story",
    patterns: [/\bminha historia\b/u, /\bminha história\b/u, /\baconteceu comigo\b/u, /\bna minha vida\b/u],
  },
  {
    id: "opinion",
    patterns: [/\bminha opiniao\b/u, /\bminha opinião\b/u, /\beu acho\b/u, /\bna minha visao\b/u, /\bna minha visão\b/u],
  },
  {
    id: "myth_busting",
    patterns: [/\bmito\b/u, /\bmitos\b/u, /\bverdade ou mito\b/u, /\bnao e verdade\b/u, /\bnão é verdade\b/u],
  },
  {
    id: "list_based",
    patterns: [/\b\d+\s+dicas\b/u, /\b\d+\s+motivos\b/u, /\btop\s+\d+\b/u, /\blista\b/u],
  },
  {
    id: "demonstration",
    patterns: [/\bpasso a passo\b/u, /\bmostrando\b/u, /\bna pratica\b/u, /\bna prática\b/u, /\bdemonstro\b/u],
  },
];

const COMMERCIAL_MODE_PATTERNS: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: "paid_partnership",
    patterns: [/#publi\b/u, /#ad\b/u, /\bparceria paga\b/u, /\bconteudo patrocinado\b/u, /\bconteúdo patrocinado\b/u],
  },
  {
    id: "affiliate",
    patterns: [/\blink de afiliado\b/u, /\bcodigo de afiliado\b/u, /\bcódigo de afiliado\b/u, /\bcomissao\b/u, /\bcomissão\b/u],
  },
  {
    id: "discount_offer",
    patterns: [/\bcupom\b/u, /\bdesconto\b/u, /\boferta\b/u, /\bfrete gratis\b/u, /\bfrete grátis\b/u],
  },
  {
    id: "lead_capture",
    patterns: [/\bcadastro\b/u, /\blista de espera\b/u, /\bmaterial gratuito\b/u, /\bbaixe\b/u, /\bentre na lista\b/u],
  },
  {
    id: "dm_conversion",
    patterns: [/\bme chama na dm\b/u, /\bme chama no direct\b/u, /\bmanda dm\b/u, /\bmanda direct\b/u],
  },
  {
    id: "product_launch",
    patterns: [/\blancamento\b/u, /\blançamento\b/u, /\babertura de carrinho\b/u, /\bem breve\b/u, /\bestreia\b/u],
  },
];

const CONTENT_INTENT_PATTERNS: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: "teach",
    patterns: [
      /\bcomo\b/u,
      /\bpasso a passo\b/u,
      /\btutorial\b/u,
      /\bguia\b/u,
      /\bdicas?\b/u,
      /\berros?\b/u,
      /\baprenda\b/u,
      /\bo que voce precisa saber\b/u,
      /\bo que você precisa saber\b/u,
    ],
  },
  {
    id: "inform",
    patterns: [
      /\bnoticia\b/u,
      /\bnotícia\b/u,
      /\batualizacao\b/u,
      /\batualização\b/u,
      /\bo que aconteceu\b/u,
      /\bentenda\b/u,
      /\balerta\b/u,
      /\bcontexto\b/u,
    ],
  },
  {
    id: "entertain",
    patterns: [
      /\bpov\b/u,
      /\bmeme\b/u,
      /\bexpectativa\s*x\s*realidade\b/u,
      /\bbrincadeira\b/u,
      /\bplot twist\b/u,
    ],
  },
  {
    id: "inspire",
    patterns: [
      /\blembrete\b/u,
      /\bmotivac(?:ao|ão)\b/u,
      /\bnao desista\b/u,
      /\bnão desista\b/u,
      /\bvoce consegue\b/u,
      /\bvocê consegue\b/u,
      /\bgratid(?:ao|ão)\b/u,
    ],
  },
  {
    id: "build_authority",
    patterns: [
      /\banalise\b/u,
      /\banálise\b/u,
      /\bestrategia\b/u,
      /\bestratégia\b/u,
      /\bo erro que eu vejo\b/u,
      /\bminha analise\b/u,
      /\bminha análise\b/u,
      /\bconsultoria\b/u,
    ],
  },
  {
    id: "convert",
    patterns: [
      /\bcompre\b/u,
      /\bgaranta\b/u,
      /\boferta\b/u,
      /\bcupom\b/u,
      /\bdesconto\b/u,
      /\blink na bio\b/u,
      /\bchama na dm\b/u,
      /\bchama no direct\b/u,
      /\blista de espera\b/u,
      /\babertura de carrinho\b/u,
    ],
  },
  {
    id: "connect",
    patterns: [
      /\bamigas?\b/u,
      /\bquem nunca\b/u,
      /\bdesabafo\b/u,
      /\bconfissao\b/u,
      /\bconfissão\b/u,
      /\bvoce tambem\b/u,
      /\bvocê também\b/u,
      /\brevelando nosso segredo\b/u,
      /\brevelando meu segredo\b/u,
      /\brotina\b/u,
    ],
  },
  {
    id: "announce",
    patterns: [
      /\bnovidade\b/u,
      /\blancamento\b/u,
      /\blançamento\b/u,
      /\bagenda aberta\b/u,
      /\babriu\b/u,
      /\bestreia\b/u,
      /\bchegou\b/u,
    ],
  },
];

const NARRATIVE_FORM_PATTERNS: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: "tutorial",
    patterns: [
      /\bcomo\b/u,
      /\bpasso a passo\b/u,
      /\btutorial\b/u,
      /\bdicas?\b/u,
      /\berros?\b/u,
      /\bchecklist\b/u,
      /\bguia\b/u,
    ],
  },
  {
    id: "day_in_the_life",
    patterns: [
      /\bminha rotina\b/u,
      /\bnossa rotina\b/u,
      /\brotina de\b/u,
      /\bvlog\b/u,
      /\bgrwm\b/u,
      /\barrume se comigo\b/u,
      /\barrume-se comigo\b/u,
      /\bmeu dia\b/u,
    ],
  },
  {
    id: "behind_the_scenes",
    patterns: [
      /\bbastidores\b/u,
      /\bmaking of\b/u,
      /\bpor tras\b/u,
      /\bpor trás\b/u,
      /\bprocesso\b/u,
    ],
  },
  {
    id: "q_and_a",
    patterns: [
      /\bq&a\b/u,
      /\bperguntas? e respostas?\b/u,
      /\bme perguntaram\b/u,
      /\brespondendo perguntas\b/u,
    ],
  },
  {
    id: "comparison",
    patterns: [
      /\bversus\b/u,
      /\bvs\b/u,
      /\bcomparando\b/u,
      /\bqual vale mais a pena\b/u,
      /\bmelhor entre\b/u,
    ],
  },
  {
    id: "review",
    patterns: [
      /\breview\b/u,
      /\bresenha\b/u,
      /\btestei\b/u,
      /\bminhas impress(?:oes|ões)\b/u,
      /\bvale a pena\b/u,
    ],
  },
  {
    id: "reaction",
    patterns: [/\breagindo\b/u, /\breact\b/u, /\bminha reacao\b/u, /\bminha reação\b/u],
  },
  {
    id: "news_update",
    patterns: [/\bnoticia\b/u, /\bnotícia\b/u, /\batualizacao\b/u, /\batualização\b/u, /\bo que aconteceu\b/u],
  },
  {
    id: "sketch_scene",
    patterns: [/\bpov\b/u, /\bexpectativa\s*x\s*realidade\b/u, /\bcena\b/u, /\besquete\b/u],
  },
  {
    id: "clip",
    patterns: [/\bcorte\b/u, /\btrecho\b/u, /\bclipe\b/u],
  },
  {
    id: "unboxing",
    patterns: [/\bunboxing\b/u, /\babrindo\b/u, /\bprimeiras impress(?:oes|ões)\b/u],
  },
  {
    id: "guest_appearance",
    patterns: [/\bcollab\b/u, /\bfeat\b/u, /\bparticipacao especial\b/u, /\bparticipação especial\b/u],
  },
];

function cloneEmptyClassificationResult(): ClassificationResult {
  return {
    format: [],
    proposal: [],
    context: [],
    tone: [],
    references: [],
    contentIntent: [],
    narrativeForm: [],
    contentSignals: [],
    stance: [],
    proofStyle: [],
    commercialMode: [],
  };
}

function normalizeFieldLookupKey(value?: string | null) {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeContentText(value?: string | null) {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function flattenValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenValue(entry));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap((entry) => flattenValue(entry));
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function buildCategoryDescriptions(
  categories: Array<Category | ClassificationV2Category | ClassificationV25Category>
): string {
  return categories
    .map((category) => {
      let description = `- **${category.id} (${category.label}):** ${category.description}`;
      if (category.examples && category.examples.length > 0) {
        description += ` (Ex: "${category.examples.join('", "')}")`;
      }
      if ("subcategories" in category && category.subcategories && category.subcategories.length > 0) {
        description +=
          "\n  Subcategorias:\n" +
          category.subcategories
            .map(
              (subcategory) =>
                `    - **${subcategory.id} (${subcategory.label}):** ${subcategory.description}`
            )
            .join("\n");
      }
      return description;
    })
    .join("\n");
}

function deriveSignalsFromDescription(description?: string | null): string[] {
  const normalizedDescription = normalizeContentText(description);
  if (!normalizedDescription) return [];

  const detectedSignals = SIGNAL_PATTERNS.flatMap(({ id, patterns }) =>
    patterns.some((pattern) => pattern.test(normalizedDescription)) ? [id] : []
  );

  return canonicalizeV2CategoryValues(uniqueStrings(detectedSignals), "contentSignal");
}

function deriveV25MatchesFromDescription(
  description: string | null | undefined,
  patterns: Array<{ id: string; patterns: RegExp[] }>
) {
  const normalizedDescription = normalizeContentText(description);
  if (!normalizedDescription) return [];

  return patterns.flatMap(({ id, patterns: entries }) =>
    entries.some((pattern) => pattern.test(normalizedDescription)) ? [id] : []
  );
}

function deriveV2MatchesFromDescription(
  description: string | null | undefined,
  patterns: Array<{ id: string; patterns: RegExp[] }>
) {
  const normalizedDescription = normalizeContentText(description);
  if (!normalizedDescription) return [];

  return patterns.flatMap(({ id, patterns: entries }) =>
    entries.some((pattern) => pattern.test(normalizedDescription)) ? [id] : []
  );
}

function deriveFallbackV2Fields(
  description: string | null | undefined,
  proposal: string[],
  tone: string[]
): Pick<
  ClassificationResult,
  "contentIntent" | "narrativeForm" | "contentSignals" | "stance" | "proofStyle" | "commercialMode"
> {
  const fallbackIntents = proposal.flatMap((value) => PROPOSAL_TO_CONTENT_INTENT[value] ?? []);
  if (fallbackIntents.length === 0) {
    fallbackIntents.push(...tone.flatMap((value) => TONE_TO_CONTENT_INTENT[value] ?? []));
  }
  if (fallbackIntents.length === 0) {
    fallbackIntents.push(...deriveV2MatchesFromDescription(description, CONTENT_INTENT_PATTERNS));
  }

  const fallbackNarrativeForms = proposal.flatMap(
    (value) => PROPOSAL_TO_NARRATIVE_FORM[value] ?? []
  );
  if (fallbackNarrativeForms.length === 0) {
    fallbackNarrativeForms.push(
      ...deriveV2MatchesFromDescription(description, NARRATIVE_FORM_PATTERNS)
    );
  }
  const fallbackSignals = [
    ...proposal.flatMap((value) => PROPOSAL_TO_CONTENT_SIGNALS[value] ?? []),
    ...deriveSignalsFromDescription(description),
  ];
  const fallbackStance = [
    ...proposal.flatMap((value) => PROPOSAL_TO_STANCE[value] ?? []),
    ...tone.flatMap((value) => TONE_TO_STANCE[value] ?? []),
    ...deriveV25MatchesFromDescription(description, STANCE_PATTERNS),
  ];
  const fallbackProofStyle = deriveV25MatchesFromDescription(description, PROOF_STYLE_PATTERNS);
  const fallbackCommercialMode = [
    ...deriveV25MatchesFromDescription(description, COMMERCIAL_MODE_PATTERNS),
    ...(fallbackSignals.includes("sponsored") ? ["paid_partnership"] : []),
    ...(fallbackSignals.includes("promo_offer") ? ["discount_offer"] : []),
    ...(fallbackSignals.includes("dm_cta") ? ["dm_conversion"] : []),
  ];
  if (
    fallbackIntents.length === 0 &&
    (fallbackCommercialMode.length > 0 ||
      fallbackSignals.some((value) =>
        ["link_in_bio_cta", "dm_cta", "promo_offer", "sponsored"].includes(value)
      ))
  ) {
    fallbackIntents.push("convert");
  }
  if (
    fallbackNarrativeForms.length === 0 &&
    fallbackIntents.includes("teach") &&
    fallbackProofStyle.some((value) => ["demonstration", "list_based"].includes(value))
  ) {
    fallbackNarrativeForms.push("tutorial");
  }
  if (
    fallbackStance.length === 0 &&
    fallbackProofStyle.includes("personal_story")
  ) {
    fallbackStance.push("testimonial");
  }

  return {
    contentIntent: canonicalizeV2CategoryValues(uniqueStrings(fallbackIntents), "contentIntent"),
    narrativeForm: canonicalizeV2CategoryValues(
      uniqueStrings(fallbackNarrativeForms),
      "narrativeForm"
    ),
    contentSignals: canonicalizeV2CategoryValues(
      uniqueStrings(fallbackSignals),
      "contentSignal"
    ),
    stance: canonicalizeV25CategoryValues(uniqueStrings(fallbackStance), "stance"),
    proofStyle: canonicalizeV25CategoryValues(uniqueStrings(fallbackProofStyle), "proofStyle"),
    commercialMode: canonicalizeV25CategoryValues(
      uniqueStrings(fallbackCommercialMode),
      "commercialMode"
    ),
  };
}

export function buildClassificationOpenAiPayload(description: string, model: string) {
  const systemPrompt = `
Você é um especialista em análise de conteúdo de mídias sociais. Sua tarefa é analisar a descrição de um post, incluindo hashtags, e classificá-lo em ONZE dimensões.

REGRAS CRÍTICAS:
1. USE APENAS IDs: responda somente com os IDs exatos das categorias fornecidas. Nunca use labels.
2. NÃO INVENTE CATEGORIAS: use apenas IDs listados. Se não houver encaixe claro, retorne array vazio.
3. SAÍDA JSON PURA: devolva apenas um objeto JSON, sem texto extra.
4. ESPECIFICIDADE: em context e references, prefira sempre a subcategoria mais específica em vez da categoria pai.
5. PROPOSAL É LEGADO: em proposal, escolha o ângulo editorial mais representativo. Não use call_to_action apenas porque a legenda diz "comenta", "salva", "link na bio" ou algo similar.
6. CONTENT INTENT: representa a intenção principal do conteúdo em nível estratégico.
7. NARRATIVE FORM: representa como a ideia é executada narrativamente.
8. CONTENT SIGNALS: registre CTA, publi, collab, giveaway ou participação em trend aqui. Sinais acessórios devem ir aqui, não dominar proposal.
9. TOM: escolha o tom predominante do conteúdo legado, considerando linguagem, emojis e atitude geral.
10. STANCE: identifica a postura do criador diante do tema, produto ou opinião.
11. PROOF STYLE: identifica o tipo de prova usado para sustentar a mensagem.
12. COMMERCIAL MODE: identifica a mecânica comercial principal quando houver.
13. HASHTAGS IMPORTAM: hashtags são pistas fortes para contexto, references, proposta e sinais.

Retorne exatamente este formato:
{
  "format": [],
  "proposal": [],
  "context": [],
  "tone": [],
  "references": [],
  "contentIntent": [],
  "narrativeForm": [],
  "contentSignals": [],
  "stance": [],
  "proofStyle": [],
  "commercialMode": []
}
  `.trim();

  const userPrompt = `**Descrição:**\n"${description}"\n\n**Categorias:**\nFormato: ${buildCategoryDescriptions(
    formatCategories
  )}\nProposta: ${buildCategoryDescriptions(
    proposalCategories
  )}\nContexto: ${buildCategoryDescriptions(
    contextCategories
  )}\nTom: ${buildCategoryDescriptions(
    toneCategories
  )}\nReferências: ${buildCategoryDescriptions(
    referenceCategories
  )}\nIntento Estratégico: ${buildCategoryDescriptions(
    contentIntentCategories
  )}\nForma Narrativa: ${buildCategoryDescriptions(
    narrativeFormCategories
  )}\nSinais de Conteúdo: ${buildCategoryDescriptions(
    contentSignalCategories
  )}\nPostura: ${buildCategoryDescriptions(
    stanceCategories
  )}\nTipo de Prova: ${buildCategoryDescriptions(
    proofStyleCategories
  )}\nModo Comercial: ${buildCategoryDescriptions(commercialModeCategories)}`;

  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  };
}

export function normalizeClassificationResponse(rawResult: unknown): ClassificationResult {
  const normalized = cloneEmptyClassificationResult();
  const normalizedKeyMapping = Object.fromEntries(
    Object.entries(RESULT_KEY_MAPPING).map(([field, aliases]) => [
      field,
      new Set(aliases.map((alias) => normalizeFieldLookupKey(alias))),
    ])
  ) as Record<keyof ClassificationResult, Set<string>>;

  if (!rawResult || typeof rawResult !== "object") {
    return normalized;
  }

  for (const [rawKey, rawValue] of Object.entries(rawResult)) {
    const normalizedKey = normalizeFieldLookupKey(rawKey);
    const standardKey = (Object.keys(normalizedKeyMapping) as Array<keyof ClassificationResult>).find(
      (field) => normalizedKeyMapping[field].has(normalizedKey)
    );

    if (!standardKey) continue;

    normalized[standardKey].push(...flattenValue(rawValue));
  }

  for (const field of Object.keys(normalized) as Array<keyof ClassificationResult>) {
    normalized[field] = uniqueStrings(
      normalized[field].filter((value) => typeof value === "string" && value.trim().length > 0)
    );
  }

  return normalized;
}

export function buildMetricClassificationUpdate(
  metric: MetricClassificationSeed,
  classification: ClassificationResult
): MetricClassificationUpdateData {
  const format =
    metric.source === "api"
      ? resolveFormatFromMetricType(metric.type)
      : canonicalizeCategoryValues(classification.format, "format");
  const canonicalProposal = canonicalizeCategoryValues(classification.proposal, "proposal");
  const proposal = sanitizeLegacyProposalValues(canonicalProposal);
  const context = canonicalizeCategoryValues(classification.context, "context");
  const tone = canonicalizeCategoryValues(classification.tone, "tone");
  const references = canonicalizeCategoryValues(classification.references, "reference");

  const aiContentIntent = canonicalizeV2CategoryValues(
    classification.contentIntent,
    "contentIntent"
  );
  const aiNarrativeForm = canonicalizeV2CategoryValues(
    classification.narrativeForm,
    "narrativeForm"
  );
  const aiContentSignals = canonicalizeV2CategoryValues(
    classification.contentSignals,
    "contentSignal"
  );
  const aiStance = canonicalizeV25CategoryValues(classification.stance, "stance");
  const aiProofStyle = canonicalizeV25CategoryValues(classification.proofStyle, "proofStyle");
  const aiCommercialMode = canonicalizeV25CategoryValues(
    classification.commercialMode,
    "commercialMode"
  );
  const fallbackV2 = deriveFallbackV2Fields(metric.description, canonicalProposal, tone);

  return {
    format,
    proposal,
    context,
    tone,
    references,
    contentIntent: aiContentIntent.length > 0 ? aiContentIntent : fallbackV2.contentIntent,
    narrativeForm: aiNarrativeForm.length > 0 ? aiNarrativeForm : fallbackV2.narrativeForm,
    contentSignals: uniqueStrings([...aiContentSignals, ...fallbackV2.contentSignals]),
    stance: aiStance.length > 0 ? aiStance : fallbackV2.stance,
    proofStyle: aiProofStyle.length > 0 ? aiProofStyle : fallbackV2.proofStyle,
    commercialMode:
      aiCommercialMode.length > 0
        ? uniqueStrings([...aiCommercialMode, ...fallbackV2.commercialMode])
        : fallbackV2.commercialMode,
  };
}

export function createEmptyMetricClassificationUpdate(): MetricClassificationUpdateData {
  return cloneEmptyClassificationResult();
}

function resolveFormatFromMetricType(metricType?: string | null): string[] {
  switch (metricType) {
    case "REEL":
    case "VIDEO":
      return ["reel"];
    case "IMAGE":
      return ["photo"];
    case "CAROUSEL_ALBUM":
      return ["carousel"];
    default:
      return [];
  }
}

export function getEmptyClassificationResult(): ClassificationResult {
  return cloneEmptyClassificationResult();
}
