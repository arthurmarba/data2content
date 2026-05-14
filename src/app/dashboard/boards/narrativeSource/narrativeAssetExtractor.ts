import type {
  CreatorNarrativeSignal,
  CreatorNarrativeSignalType,
  NarrativeAsset,
  NarrativeAssetType,
  NarrativeSource,
  NarrativeSourceIntentDetection,
} from "./narrativeSourceTypes";

type ExtractionResult = {
  assets: NarrativeAsset[];
  profileSignals: CreatorNarrativeSignal[];
  summary: string;
  suggestedNextStep: string;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createId(prefix: string, value: string): string {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}-${slug || "generic"}`;
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function buildAnalysisText(source: NarrativeSource, intentDetection: NarrativeSourceIntentDetection): string {
  return normalizeText(
    [
      source.creatorQuestion,
      source.rawText,
      source.transcript,
      source.visualDescription,
      source.metadata.title,
      source.metadata.campaignContext,
      intentDetection.normalizedQuestion,
      intentDetection.signals.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function addAsset(
  assets: NarrativeAsset[],
  params: {
    type: NarrativeAssetType;
    value: string;
    confidence: number;
    evidence?: string | null;
  }
) {
  const exists = assets.some((asset) => asset.type === params.type && asset.value === params.value);
  if (exists) return;

  assets.push({
    id: createId(`asset-${params.type.replace(/_/g, "-")}`, params.value),
    type: params.type,
    value: params.value,
    confidence: params.confidence,
    evidence: params.evidence ?? null,
  });
}

function addSignal(
  profileSignals: CreatorNarrativeSignal[],
  source: NarrativeSource,
  params: {
    signalType: CreatorNarrativeSignalType;
    value: string;
    confidence: number;
    shouldPersistLater?: boolean;
    evidence?: string | null;
  }
) {
  const exists = profileSignals.some(
    (signal) => signal.signalType === params.signalType && signal.value === params.value
  );
  if (exists) return;

  profileSignals.push({
    id: createId(`signal-${params.signalType.replace(/_/g, "-")}`, params.value),
    signalType: params.signalType,
    value: params.value,
    confidence: params.confidence,
    sourceType: source.sourceType,
    shouldPersistLater: params.shouldPersistLater ?? false,
    evidence: params.evidence ?? null,
  });
}

function addRoutineSignals(assets: NarrativeAsset[], profileSignals: CreatorNarrativeSignal[], source: NarrativeSource) {
  addAsset(assets, {
    type: "central_theme",
    value: "rotina de autocuidado",
    confidence: 0.82,
    evidence: "Sinais de rotina, skincare, cuidado ou autocuidado.",
  });
  addAsset(assets, {
    type: "brand_territory",
    value: "autocuidado",
    confidence: 0.78,
    evidence: "Território compatível com hábitos pessoais e cuidado.",
  });
  addAsset(assets, {
    type: "category",
    value: source.metadata.format === "reel" ? "lifestyle" : "beauty_personal_care",
    confidence: 0.7,
    evidence: "Categoria inferida por rotina/skincare/autocuidado.",
  });
  addAsset(assets, {
    type: "narrative_pattern",
    value: "rotina real",
    confidence: 0.76,
    evidence: "A fonte aponta para uma narrativa de hábito cotidiano.",
  });
  addSignal(profileSignals, source, {
    signalType: "recurring_theme",
    value: "rotina",
    confidence: 0.76,
    shouldPersistLater: true,
    evidence: "Tema recorrente possível: rotina.",
  });
  addSignal(profileSignals, source, {
    signalType: "brand_territory",
    value: "autocuidado",
    confidence: 0.76,
    shouldPersistLater: true,
    evidence: "Território de marca possível: autocuidado.",
  });
}

function addWorkBehindScenesSignals(
  assets: NarrativeAsset[],
  profileSignals: CreatorNarrativeSignal[],
  source: NarrativeSource
) {
  addAsset(assets, {
    type: "central_theme",
    value: "bastidor de trabalho",
    confidence: 0.78,
    evidence: "Sinais de bastidor, trabalho, processo ou produção.",
  });
  addAsset(assets, {
    type: "content_proposal",
    value: "behind_the_scenes",
    confidence: 0.8,
    evidence: "A fonte sugere bastidor como proposta de conteúdo.",
  });
  addAsset(assets, {
    type: "narrative_pattern",
    value: "bastidor real",
    confidence: 0.78,
    evidence: "A narrativa pode se apoiar no processo acontecendo.",
  });
  addAsset(assets, {
    type: "creator_role",
    value: "estrategista",
    confidence: 0.68,
    evidence: "O criador aparece conduzindo processo ou decisão.",
  });
  addSignal(profileSignals, source, {
    signalType: "content_strength",
    value: "bastidor",
    confidence: 0.74,
    shouldPersistLater: true,
    evidence: "Bastidor aparece como força de conteúdo.",
  });
  addSignal(profileSignals, source, {
    signalType: "creator_role",
    value: "estrategista",
    confidence: 0.66,
    shouldPersistLater: true,
    evidence: "Papel narrativo possível: estrategista.",
  });
}

function addHookWeaknessSignals(
  assets: NarrativeAsset[],
  profileSignals: CreatorNarrativeSignal[],
  source: NarrativeSource
) {
  addAsset(assets, {
    type: "weakness",
    value: "gancho precisa ficar mais claro",
    confidence: 0.84,
    evidence: "A fonte menciona começo fraco, gancho ou primeiros segundos.",
  });
  addAsset(assets, {
    type: "hook_signal",
    value: "abrir com tensão mais cedo",
    confidence: 0.82,
    evidence: "O ajuste principal está na abertura do conteúdo.",
  });
  addSignal(profileSignals, source, {
    signalType: "recurring_insecurity",
    value: "força do gancho",
    confidence: 0.74,
    shouldPersistLater: true,
    evidence: "A insegurança aparece ligada ao começo do conteúdo.",
  });
  addSignal(profileSignals, source, {
    signalType: "content_weakness",
    value: "abertura",
    confidence: 0.76,
    shouldPersistLater: true,
    evidence: "Abertura aparece como ponto de ajuste.",
  });
}

function addBrandSignals(assets: NarrativeAsset[], profileSignals: CreatorNarrativeSignal[], source: NarrativeSource) {
  addAsset(assets, {
    type: "brand_territory",
    value: "marca em contexto orgânico",
    confidence: 0.82,
    evidence: "A fonte menciona marca, publi, campanha ou potencial comercial.",
  });
  addAsset(assets, {
    type: "audience_reaction",
    value: "confiança/identificação",
    confidence: 0.72,
    evidence: "O encaixe de marca depende de parecer natural para a audiência.",
  });
  addAsset(assets, {
    type: "content_proposal",
    value: "organic_brand_fit",
    confidence: 0.8,
    evidence: "Proposta de conteúdo com marca integrada ao contexto.",
  });
  addSignal(profileSignals, source, {
    signalType: "brand_territory",
    value: "marca em contexto orgânico",
    confidence: 0.78,
    shouldPersistLater: true,
    evidence: "Território comercial possível sem tirar o contexto narrativo.",
  });
  addSignal(profileSignals, source, {
    signalType: "audience_goal",
    value: "confiança",
    confidence: 0.7,
    shouldPersistLater: true,
    evidence: "A reação desejada envolve confiança no encaixe.",
  });
}

function addCollabSignals(assets: NarrativeAsset[], profileSignals: CreatorNarrativeSignal[], source: NarrativeSource) {
  addAsset(assets, {
    type: "collab_opportunity",
    value: "criador complementar",
    confidence: 0.82,
    evidence: "A fonte menciona collab, parceria, dupla ou outro creator.",
  });
  addAsset(assets, {
    type: "content_proposal",
    value: "collab_narrativa",
    confidence: 0.8,
    evidence: "A proposta depende da troca entre creators.",
  });
  addSignal(profileSignals, source, {
    signalType: "audience_goal",
    value: "conversa entre comunidades",
    confidence: 0.74,
    shouldPersistLater: true,
    evidence: "A collab pode aproximar audiências complementares.",
  });
}

function addPositioningSignals(
  assets: NarrativeAsset[],
  profileSignals: CreatorNarrativeSignal[],
  source: NarrativeSource
) {
  addAsset(assets, {
    type: "creator_role",
    value: "autoridade em construção",
    confidence: 0.8,
    evidence: "A fonte menciona posicionamento, autoridade, imagem ou identidade.",
  });
  addAsset(assets, {
    type: "narrative_pattern",
    value: "posicionamento",
    confidence: 0.78,
    evidence: "O foco é coerência com a identidade do criador.",
  });
  addSignal(profileSignals, source, {
    signalType: "positioning_signal",
    value: "autoridade",
    confidence: 0.76,
    shouldPersistLater: true,
    evidence: "Sinal de posicionamento ligado a autoridade.",
  });
  addSignal(profileSignals, source, {
    signalType: "creator_role",
    value: "autoridade em construção",
    confidence: 0.74,
    shouldPersistLater: true,
    evidence: "Papel narrativo possível: autoridade em construção.",
  });
}

function addCommentSignals(assets: NarrativeAsset[], profileSignals: CreatorNarrativeSignal[], source: NarrativeSource) {
  addAsset(assets, {
    type: "content_proposal",
    value: "comment_to_post",
    confidence: 0.82,
    evidence: "A fonte nasce de comentário ou dúvida da audiência.",
  });
  addAsset(assets, {
    type: "audience_reaction",
    value: "resposta à dúvida da audiência",
    confidence: 0.8,
    evidence: "A narrativa pode responder diretamente a uma pergunta recebida.",
  });
  addSignal(profileSignals, source, {
    signalType: "audience_goal",
    value: "conversa",
    confidence: 0.76,
    shouldPersistLater: true,
    evidence: "A fonte aponta para conversa com a audiência.",
  });
}

function addScriptCaptionSignals(
  assets: NarrativeAsset[],
  profileSignals: CreatorNarrativeSignal[],
  source: NarrativeSource,
  text: string
) {
  const preferredFormat = source.sourceType === "caption" ? "legenda" : "roteiro";

  addAsset(assets, {
    type: "format_fit",
    value: "roteiro/legenda como ponto de partida",
    confidence: 0.7,
    evidence: "A fonte usa roteiro, legenda ou formato textual estruturado.",
  });
  addSignal(profileSignals, source, {
    signalType: "preferred_format",
    value: preferredFormat,
    confidence: 0.68,
    shouldPersistLater: true,
    evidence: `Fonte textual indica preferência por ${preferredFormat}.`,
  });

  if (hasAny(text, ["duvida", "nao sei", "fraco", "melhorar"])) {
    addAsset(assets, {
      type: "hook_signal",
      value: "clarear a intenção antes de produzir",
      confidence: 0.6,
      evidence: "A fonte textual traz sinal de dúvida ou ajuste.",
    });
  }
}

function fallbackResult(assets: NarrativeAsset[], profileSignals: CreatorNarrativeSignal[]): ExtractionResult {
  addAsset(assets, {
    type: "central_theme",
    value: "tema ainda pouco definido",
    confidence: 0.35,
    evidence: "A fonte não trouxe contexto suficiente para uma leitura específica.",
  });

  return {
    assets,
    profileSignals,
    summary: "A fonte ainda precisa de mais contexto para revelar uma narrativa clara.",
    suggestedNextStep: "Adicionar mais contexto sobre objetivo, público ou intenção do conteúdo.",
  };
}

export function extractNarrativeAssets(params: {
  source: NarrativeSource;
  intentDetection: NarrativeSourceIntentDetection;
}): ExtractionResult {
  const { source, intentDetection } = params;
  const text = buildAnalysisText(source, intentDetection);
  const assets: NarrativeAsset[] = [];
  const profileSignals: CreatorNarrativeSignal[] = [];

  if (hasAny(text, ["rotina", "skincare", "autocuidado", "manha", "cuidado"])) {
    addRoutineSignals(assets, profileSignals, source);
  }

  if (hasAny(text, ["bastidor", "trabalho", "processo", "reuniao", "gravacao", "producao"])) {
    addWorkBehindScenesSignals(assets, profileSignals, source);
  }

  if (
    intentDetection.intent === "improve_content" ||
    hasAny(text, ["comeco fraco", "gancho", "prender atencao", "primeiros segundos"])
  ) {
    addHookWeaknessSignals(assets, profileSignals, source);
  }

  if (
    intentDetection.intent === "brand_potential" ||
    intentDetection.intent === "adapt_to_ad" ||
    hasAny(text, ["marca", "publi", "campanha", "patrocinado"])
  ) {
    addBrandSignals(assets, profileSignals, source);
  }

  if (
    intentDetection.intent === "collab_potential" ||
    hasAny(text, ["collab", "parceria", "outro creator", "dupla"])
  ) {
    addCollabSignals(assets, profileSignals, source);
  }

  if (
    intentDetection.intent === "positioning_fit" ||
    hasAny(text, ["posicionamento", "autoridade", "minha imagem", "identidade"])
  ) {
    addPositioningSignals(assets, profileSignals, source);
  }

  if (source.sourceType === "comment" || hasAny(text, ["comentaram", "comentario", "me perguntaram"])) {
    addCommentSignals(assets, profileSignals, source);
  }

  if (source.sourceType === "script" || source.sourceType === "caption" || hasAny(text, ["roteiro", "legenda"])) {
    addScriptCaptionSignals(assets, profileSignals, source, text);
  }

  if (assets.length === 0) {
    return fallbackResult(assets, profileSignals);
  }

  return {
    assets,
    profileSignals,
    summary: "A fonte já apresenta sinais narrativos úteis para orientar a próxima leitura estratégica.",
    suggestedNextStep: "Revisar os assets extraídos e escolher qual direção merece aprofundamento.",
  };
}
