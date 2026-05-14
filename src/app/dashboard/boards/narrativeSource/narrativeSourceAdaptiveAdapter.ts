import type { PostCreationAdaptiveMode } from "../postCreationAdaptiveTypes";
import type {
  CreatorNarrativeSignal,
  NarrativeAsset,
  NarrativeSource,
  NarrativeSourceIntent,
  NarrativeSourceIntentDetection,
} from "./narrativeSourceTypes";

type NarrativeSourceExtraction = {
  assets: NarrativeAsset[];
  profileSignals: CreatorNarrativeSignal[];
  summary: string;
  suggestedNextStep: string;
};

export type NarrativeSourceAdaptiveInput = {
  input: string;
  modeHint: PostCreationAdaptiveMode | null;
  sourceSummary: string;
  signals: string[];
};

const MODE_BY_INTENT: Record<NarrativeSourceIntent, PostCreationAdaptiveMode> = {
  validate_before_posting: "validate_pauta",
  improve_content: "validate_pauta",
  discover_narrative: "discover_pauta",
  brand_potential: "brand_match",
  adapt_to_ad: "brand_match",
  collab_potential: "collab_match",
  positioning_fit: "validate_pauta",
  general_question: "unknown",
  unknown: "unknown",
};

const BLOCKED_LANGUAGE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bgarantido\b/gi, "prometido"],
  [/\bcerteza\b/gi, "clareza"],
  [/\bcomprovado\b/gi, "observado"],
  [/\bviralizar\b/gi, "ampliar alcance"],
  [/\bscore\b/gi, "leitura"],
  [/\bnota\b/gi, "leitura"],
  [/\bpontuação\b/gi, "leitura"],
  [/\bacerto\b/gi, "sinal"],
  [/\berro\b/gi, "ajuste"],
  [/\bgabarito\b/gi, "referência"],
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: string | null | undefined, fallback: string): string {
  const compacted = sanitizeGeneratedText((value || "").replace(/\s+/g, " ").trim());
  if (!compacted) return fallback;
  return compacted.length > 90 ? `${compacted.slice(0, 87).trim()}...` : compacted;
}

function sanitizeGeneratedText(value: string): string {
  return BLOCKED_LANGUAGE_REPLACEMENTS.reduce(
    (currentValue, [pattern, replacement]) => currentValue.replace(pattern, replacement),
    value
  );
}

function firstAssetValue(assets: NarrativeAsset[], type: NarrativeAsset["type"]): string | null {
  return assets.find((asset) => asset.type === type && asset.value.trim())?.value.trim() || null;
}

function firstSignalValue(
  profileSignals: CreatorNarrativeSignal[],
  signalType: CreatorNarrativeSignal["signalType"]
): string | null {
  return profileSignals.find((signal) => signal.signalType === signalType && signal.value.trim())?.value.trim() || null;
}

function chooseTheme(source: NarrativeSource, assets: NarrativeAsset[]): string {
  return sanitizeGeneratedText(
    firstAssetValue(assets, "central_theme") ||
      firstAssetValue(assets, "narrative_pattern") ||
      compactText(source.metadata.title, "") ||
      compactText(source.rawText, "") ||
      compactText(source.transcript, "") ||
      "tema ainda pouco definido"
  );
}

function chooseBrandTerritory(
  source: NarrativeSource,
  assets: NarrativeAsset[],
  profileSignals: CreatorNarrativeSignal[]
): string {
  return sanitizeGeneratedText(
    firstAssetValue(assets, "brand_territory") ||
      firstSignalValue(profileSignals, "brand_territory") ||
      compactText(source.metadata.campaignContext, "") ||
      "marca em contexto orgânico"
  );
}

function buildSignals(params: {
  intentDetection: NarrativeSourceIntentDetection;
  assets: NarrativeAsset[];
  profileSignals: CreatorNarrativeSignal[];
}): string[] {
  const seen = new Set<string>();
  const signals: string[] = [];

  for (const value of [
    ...params.intentDetection.signals,
    ...params.assets.map((asset) => asset.value),
    ...params.profileSignals.map((signal) => signal.value),
  ]) {
    const safeValue = sanitizeGeneratedText(value).trim();
    const key = normalizeText(safeValue).toLowerCase();
    if (!safeValue || seen.has(key)) continue;

    seen.add(key);
    signals.push(safeValue);
    if (signals.length >= 12) break;
  }

  return signals;
}

function buildInput(params: {
  intent: NarrativeSourceIntent;
  source: NarrativeSource;
  extraction: NarrativeSourceExtraction;
  theme: string;
  territory: string;
}): string {
  const fallback = compactText(
    params.source.creatorQuestion || params.source.rawText || params.extraction.summary,
    "Quero explorar uma pauta com mais contexto narrativo."
  );

  switch (params.intent) {
    case "validate_before_posting":
      return `Quero validar uma pauta sobre ${params.theme} antes de postar.`;
    case "improve_content":
      return `Quero melhorar uma pauta sobre ${params.theme}, principalmente o gancho e a clareza.`;
    case "discover_narrative":
      return `Não sei o que postar para explorar a narrativa sobre ${params.theme}.`;
    case "brand_potential":
      return `Quero atrair marcas de ${params.territory} com uma narrativa sobre ${params.theme}.`;
    case "adapt_to_ad":
      return `Quero adaptar uma pauta sobre ${params.theme} para uma campanha/publi de ${params.territory} sem parecer forçado.`;
    case "collab_potential":
      return `Quero fazer uma collab em uma narrativa sobre ${params.theme}.`;
    case "positioning_fit":
      return `Quero validar se uma pauta sobre ${params.theme} combina com meu posicionamento.`;
    default:
      return fallback;
  }
}

export function buildAdaptiveInputFromNarrativeSource(params: {
  source: NarrativeSource;
  intentDetection: NarrativeSourceIntentDetection;
  extraction: NarrativeSourceExtraction;
}): NarrativeSourceAdaptiveInput {
  const { source, intentDetection, extraction } = params;
  const modeHint = MODE_BY_INTENT[intentDetection.intent] ?? null;
  const theme = chooseTheme(source, extraction.assets);
  const territory = chooseBrandTerritory(source, extraction.assets, extraction.profileSignals);
  const input = sanitizeGeneratedText(
    buildInput({
      intent: intentDetection.intent,
      source,
      extraction,
      theme,
      territory,
    })
  );
  const signals = buildSignals({
    intentDetection,
    assets: extraction.assets,
    profileSignals: extraction.profileSignals,
  });

  return {
    input,
    modeHint,
    sourceSummary: sanitizeGeneratedText(
      `Fonte ${source.sourceType} com intenção ${intentDetection.intent}, tema ${theme}, ${extraction.assets.length} assets e ${extraction.profileSignals.length} sinais de perfil.`
    ),
    signals,
  };
}
