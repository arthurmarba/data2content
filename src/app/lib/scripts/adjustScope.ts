export type ScriptAdjustMode = "patch" | "rewrite_full" | "new_script";

export type ScriptAdjustTarget =
  | { type: "none" }
  | { type: "scene"; index: number }
  | { type: "paragraph"; index: number }
  | { type: "first_paragraph" }
  | { type: "last_paragraph" };

export type ScriptAdjustScope = {
  mode: ScriptAdjustMode;
  target: ScriptAdjustTarget;
  isPartialEdit: boolean;
  rawPrompt: string;
};

const NEW_SCRIPT_REGEX =
  /(?:crie|gere|fa[cç]a|quero|preciso).{0,28}(?:novo|outro).{0,18}roteiro|(?:novo|outro)\s+roteiro/i;
const FULL_REWRITE_REGEX =
  /(?:reescrev|refa[cç]a|recrie|mude|reformule).{0,26}(?:tudo|todo|inteiro|completo)|(?:do zero)|(?:reestruture).{0,14}(?:inteiro|completo)/i;
const SCENE_REGEX = /(?:cena|scene)\s*(?:#\s*)?(\d{1,3})/i;
const PARAGRAPH_REGEX = /(?:par[aá]grafo)\s*(\d{1,3})/i;
const FIRST_PARAGRAPH_REGEX =
  /(primeir[oa].{0,24}par[aá]grafo|par[aá]grafo inicial|abertura|introdu[cç][aã]o|intro)/i;
const LAST_PARAGRAPH_REGEX =
  /([uú]ltim[oa].{0,24}par[aá]grafo|par[aá]grafo final|fechamento|conclus[aã]o|encerramento|final)/i;
const PARTIAL_HINT_REGEX = /(apenas|somente|s[oó]|só|minim[oa]|trecho|parte|bloco)/i;

function clampIndex(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

export function detectScriptAdjustScope(promptRaw: string): ScriptAdjustScope {
  const prompt = String(promptRaw || "").trim();
  const sceneMatch = prompt.match(SCENE_REGEX);
  const paragraphMatch = prompt.match(PARAGRAPH_REGEX);
  const hasFirstParagraphIntent = FIRST_PARAGRAPH_REGEX.test(prompt);
  const hasLastParagraphIntent = LAST_PARAGRAPH_REGEX.test(prompt);

  let target: ScriptAdjustTarget = { type: "none" };
  if (sceneMatch?.[1]) {
    target = { type: "scene", index: clampIndex(Number(sceneMatch[1])) };
  } else if (paragraphMatch?.[1]) {
    target = { type: "paragraph", index: clampIndex(Number(paragraphMatch[1])) };
  } else if (hasFirstParagraphIntent) {
    target = { type: "first_paragraph" };
  } else if (hasLastParagraphIntent) {
    target = { type: "last_paragraph" };
  }

  let mode: ScriptAdjustMode = "patch";
  if (NEW_SCRIPT_REGEX.test(prompt)) {
    mode = "new_script";
  } else if (FULL_REWRITE_REGEX.test(prompt)) {
    mode = "rewrite_full";
  }

  // Escopo explícito sempre implica patch direcionado, mesmo com verbos fortes.
  if (target.type !== "none") {
    mode = "patch";
  }

  const isPartialEdit = target.type !== "none" || (mode === "patch" && PARTIAL_HINT_REGEX.test(prompt));

  return {
    mode,
    target,
    isPartialEdit,
    rawPrompt: prompt,
  };
}

export function describeScriptAdjustTarget(target: ScriptAdjustTarget): string {
  if (target.type === "scene") return `Cena ${target.index}`;
  if (target.type === "paragraph") return `Parágrafo ${target.index}`;
  if (target.type === "first_paragraph") return "Primeiro parágrafo";
  if (target.type === "last_paragraph") return "Último parágrafo";
  return "Roteiro completo";
}
