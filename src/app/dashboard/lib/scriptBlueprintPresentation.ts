export type ScriptBlueprintScenePresentation = {
  label: string;
  visual: string;
  message: string;
  direction: string;
  strategyReason: string;
};

export type ScriptBlueprintEditorialPresentation = {
  whatToPost: string;
  whyPostThisWay: string;
  whenToPost: string;
  howVideoShouldWork: string;
};

export type ScriptBlueprintPresentation = {
  hasStructuredScenes: boolean;
  editorialSummary: ScriptBlueprintEditorialPresentation | null;
  scenes: ScriptBlueprintScenePresentation[];
  previewVisual: string;
  previewMessage: string;
  previewDirection: string;
  previewReason: string;
  previewText: string;
};

const STRATEGIC_REASON_PATTERN = /\bPor que assim:\s*/i;

function stripFormatting(value: string) {
  return (value || "").replace(/\r/g, "").replace(/\*\*/g, "").trim();
}

function normalizeInlineText(value: string) {
  return stripFormatting(value).replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxChars: number) {
  const normalized = normalizeInlineText(value);
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;

  const sliced = normalized.slice(0, maxChars).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  const safeCut = lastSpace > maxChars * 0.7 ? sliced.slice(0, lastSpace) : sliced;
  return `${safeCut}...`;
}

function normalizeSceneLabel(rawLabel: string, index: number) {
  const cleaned = normalizeInlineText(rawLabel);
  if (!cleaned) return `Cena ${index}`;
  if (/^cena\s+/i.test(cleaned)) return cleaned.replace(/\s*:\s*/g, " • ");
  if (/^\d+/.test(cleaned)) return `Cena ${cleaned.replace(/\s*:\s*/g, " • ")}`;
  return `Cena ${index} • ${cleaned}`;
}

function appendFieldValue(current: string, next: string) {
  const cleaned = normalizeInlineText(next);
  if (!cleaned) return current;
  return current ? `${current} ${cleaned}` : cleaned;
}

function extractFieldValue(rawLine: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    if (!pattern.test(rawLine)) continue;
    return rawLine.replace(pattern, "").trim();
  }
  return null;
}

export function splitStrategicDirection(value?: string | null) {
  const normalized = normalizeInlineText(value || "").replace(/^dire[cç][aã]o\s*:\s*/i, "").trim();
  if (!normalized) {
    return {
      direction: "",
      strategyReason: "",
    };
  }

  const match = STRATEGIC_REASON_PATTERN.exec(normalized);
  if (!match) {
    return {
      direction: normalized,
      strategyReason: "",
    };
  }

  const direction = normalized
    .slice(0, match.index)
    .replace(/[:\-–—]\s*$/u, "")
    .trim();
  const strategyReason = normalized.slice(match.index + match[0].length).trim();

  return {
    direction,
    strategyReason,
  };
}

function buildScenePresentation(
  label: string,
  visual: string,
  message: string,
  rawDirection: string
): ScriptBlueprintScenePresentation | null {
  const { direction, strategyReason } = splitStrategicDirection(rawDirection);
  const scene: ScriptBlueprintScenePresentation = {
    label: normalizeInlineText(label),
    visual: normalizeInlineText(visual),
    message: normalizeInlineText(message),
    direction,
    strategyReason,
  };

  if (!scene.visual && !scene.message && !scene.direction && !scene.strategyReason) {
    return null;
  }

  return scene;
}

function parseTaggedScenes(content: string) {
  const scenes: ScriptBlueprintScenePresentation[] = [];
  const lines = stripFormatting(content).split("\n");

  let currentLabel = "";
  let currentVisual = "";
  let currentMessage = "";
  let currentDirection = "";
  let activeField: "visual" | "message" | "direction" | null = null;

  const flushScene = () => {
    const nextScene = buildScenePresentation(
      currentLabel || `Cena ${scenes.length + 1}`,
      currentVisual,
      currentMessage,
      currentDirection
    );
    if (nextScene) scenes.push(nextScene);
    currentLabel = "";
    currentVisual = "";
    currentMessage = "";
    currentDirection = "";
    activeField = null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const sceneOpenMatch = trimmed.match(/^\[(?:CENA|SCENE)\s*([^\]]*)\]$/i);
    if (sceneOpenMatch) {
      if (currentLabel || currentVisual || currentMessage || currentDirection) {
        flushScene();
      }
      currentLabel = normalizeSceneLabel(sceneOpenMatch[1] || "", scenes.length + 1);
      continue;
    }

    if (/^\[\/(?:CENA|SCENE)[^\]]*\]$/i.test(trimmed)) {
      flushScene();
      continue;
    }

    if (!currentLabel) continue;

    const visualValue = extractFieldValue(trimmed, [/^visual\s*:/i, /^imagem\s*:/i, /^o que gravar\s*:/i]);
    if (visualValue !== null) {
      currentVisual = appendFieldValue(currentVisual, visualValue);
      activeField = "visual";
      continue;
    }

    const messageValue = extractFieldValue(trimmed, [
      /^fala\s*:/i,
      /^mensagem(?: da cena)?\s*:/i,
      /^a[úu]dio\s*:/i,
      /^o que comunicar\s*:/i,
    ]);
    if (messageValue !== null) {
      currentMessage = appendFieldValue(currentMessage, messageValue);
      activeField = "message";
      continue;
    }

    const directionValue = extractFieldValue(trimmed, [
      /^dire[cç][aã]o\s*:/i,
      /^como gravar\s*:/i,
      /^como conduzir\s*:/i,
    ]);
    if (directionValue !== null) {
      currentDirection = appendFieldValue(currentDirection, directionValue);
      activeField = "direction";
      continue;
    }

    const strategyValue = extractFieldValue(trimmed, [/^por que assim\s*:/i, /^porque assim\s*:/i]);
    if (strategyValue !== null) {
      currentDirection = appendFieldValue(currentDirection, `Por que assim: ${strategyValue}`);
      activeField = "direction";
      continue;
    }

    if (activeField === "visual") {
      currentVisual = appendFieldValue(currentVisual, trimmed);
    } else if (activeField === "message") {
      currentMessage = appendFieldValue(currentMessage, trimmed);
    } else if (activeField === "direction") {
      currentDirection = appendFieldValue(currentDirection, trimmed);
    }
  }

  if (currentLabel || currentVisual || currentMessage || currentDirection) {
    flushScene();
  }

  return scenes;
}

function isTableSeparatorRow(rawLine: string) {
  const cols = rawLine
    .split("|")
    .map((col) => col.trim())
    .filter(Boolean);
  if (!cols.length) return false;
  return cols.every((col) => /^:?-{2,}:?$/.test(col.replace(/\s+/g, "")));
}

function parseTableScenes(content: string) {
  const scenes: ScriptBlueprintScenePresentation[] = [];
  const lines = stripFormatting(content).split("\n");
  let isParsingTable = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (
      trimmed.startsWith("|") &&
      /tempo|time/i.test(trimmed) &&
      /visual|cena|enquadramento/i.test(trimmed) &&
      /a[úu]dio|fala|mensagem|narra/i.test(trimmed)
    ) {
      isParsingTable = true;
      continue;
    }

    if (!isParsingTable) continue;
    if (!trimmed.startsWith("|")) break;
    if (isTableSeparatorRow(trimmed) || /^\|\s*:?[-\s|]+:?\|?$/.test(trimmed)) continue;

    const cols = trimmed
      .split("|")
      .map((col) => normalizeInlineText(col))
      .filter(Boolean);
    if (cols.length < 3) continue;

    const nextScene = buildScenePresentation(
      `Cena ${scenes.length + 1}`,
      cols[1] || "",
      cols[2] || "",
      cols.length >= 4 ? cols.slice(3).join(" | ") : ""
    );
    if (nextScene) scenes.push(nextScene);
  }

  return scenes;
}

function parseScriptScenes(content: string) {
  const taggedScenes = parseTaggedScenes(content);
  if (taggedScenes.length > 0) return taggedScenes;
  return parseTableScenes(content);
}

function parseEditorialSummary(content: string): ScriptBlueprintEditorialPresentation | null {
  const lines = stripFormatting(content).split("\n");
  let whatToPost = "";
  let whyPostThisWay = "";
  let whenToPost = "";
  let howVideoShouldWork = "";
  let activeField: keyof ScriptBlueprintEditorialPresentation | null = null;

  for (const rawLine of lines) {
    const trimmed = normalizeInlineText(rawLine);
    if (!trimmed) continue;
    if (/^\[(?:cena|scene)\s+/i.test(trimmed) || /^cena\s+\d+/i.test(trimmed) || trimmed.startsWith("|")) break;

    if (/^o que postar\s*:/i.test(trimmed)) {
      whatToPost = trimmed.replace(/^o que postar\s*:/i, "").trim();
      activeField = "whatToPost";
      continue;
    }
    if (/^por que postar(?: assim)?\s*:/i.test(trimmed) || /^por que esse v[ií]deo\s*:/i.test(trimmed)) {
      whyPostThisWay = trimmed.replace(/^por que postar(?: assim)?\s*:/i, "").replace(/^por que esse v[ií]deo\s*:/i, "").trim();
      activeField = "whyPostThisWay";
      continue;
    }
    if (/^quando postar\s*:/i.test(trimmed) || /^janela de publica[cç][aã]o\s*:/i.test(trimmed)) {
      whenToPost = trimmed.replace(/^quando postar\s*:/i, "").replace(/^janela de publica[cç][aã]o\s*:/i, "").trim();
      activeField = "whenToPost";
      continue;
    }
    if (/^como esse v[ií]deo deve funcionar\s*:/i.test(trimmed) || /^estrutura editorial\s*:/i.test(trimmed)) {
      howVideoShouldWork = trimmed
        .replace(/^como esse v[ií]deo deve funcionar\s*:/i, "")
        .replace(/^estrutura editorial\s*:/i, "")
        .trim();
      activeField = "howVideoShouldWork";
      continue;
    }

    if (activeField === "whatToPost") whatToPost = appendFieldValue(whatToPost, trimmed);
    if (activeField === "whyPostThisWay") whyPostThisWay = appendFieldValue(whyPostThisWay, trimmed);
    if (activeField === "whenToPost") whenToPost = appendFieldValue(whenToPost, trimmed);
    if (activeField === "howVideoShouldWork") howVideoShouldWork = appendFieldValue(howVideoShouldWork, trimmed);
  }

  if (!whatToPost && !whyPostThisWay && !whenToPost && !howVideoShouldWork) return null;

  return {
    whatToPost: normalizeInlineText(whatToPost),
    whyPostThisWay: normalizeInlineText(whyPostThisWay),
    whenToPost: normalizeInlineText(whenToPost),
    howVideoShouldWork: normalizeInlineText(howVideoShouldWork),
  };
}

export function buildScriptBlueprintPresentation(
  content: string,
  options?: { previewMaxChars?: number }
): ScriptBlueprintPresentation {
  const previewMaxChars = options?.previewMaxChars ?? 210;
  const normalizedContent = normalizeInlineText(content);
  if (!normalizedContent) {
    return {
      hasStructuredScenes: false,
      editorialSummary: null,
      scenes: [],
      previewVisual: "",
      previewMessage: "",
      previewDirection: "",
      previewReason: "",
      previewText: "Sem conteúdo ainda.",
    };
  }

  const editorialSummary = parseEditorialSummary(content);
  const scenes = parseScriptScenes(content);
  if (!scenes.length) {
    return {
      hasStructuredScenes: false,
      editorialSummary,
      scenes: [],
      previewVisual: "",
      previewMessage: "",
      previewDirection: "",
      previewReason: "",
      previewText: truncateText(
        editorialSummary?.whyPostThisWay ||
          editorialSummary?.whatToPost ||
          normalizedContent,
        previewMaxChars
      ),
    };
  }

  const firstScene = scenes[0]!;
  const firstReason =
    editorialSummary?.whyPostThisWay || scenes.find((scene) => scene.strategyReason)?.strategyReason || "";

  return {
    hasStructuredScenes: true,
    editorialSummary,
    scenes,
    previewVisual: firstScene.visual,
    previewMessage: firstScene.message,
    previewDirection: firstScene.direction,
    previewReason: firstReason,
    previewText: truncateText(
      firstReason || firstScene.message || firstScene.visual || normalizedContent,
      previewMaxChars
    ),
  };
}
