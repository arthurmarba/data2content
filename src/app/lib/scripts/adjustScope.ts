export type ScriptAdjustMode = "patch" | "rewrite_full" | "new_script";

export type ScriptAdjustTarget =
  | { type: "none" }
  | { type: "scene"; index: number }
  | { type: "paragraph"; index: number }
  | { type: "first_paragraph" }
  | { type: "last_paragraph" }
  | {
      type: "editorial";
      field: "what_to_post" | "why_post_this_way" | "when_to_post" | "how_video_should_work";
    };

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
const EDITORIAL_WHAT_REGEX =
  /\b(o que postar|qual v[ií]deo postar|ideia central do v[ií]deo|dire[cç][aã]o editorial)\b/i;
const EDITORIAL_WHY_REGEX =
  /\b(por que postar|justificativa estrat[ée]gica|racional estrat[ée]gico|motivo estrat[ée]gico)\b/i;
const EDITORIAL_WHEN_REGEX =
  /\b(quando postar|janela de postagem|janela de publica[cç][aã]o|hor[aá]rio de postagem|timing|dia e hora)\b/i;
const EDITORIAL_HOW_REGEX =
  /\b(como esse v[ií]deo deve funcionar|estrutura editorial|estrutura do v[ií]deo|[âa]ngulo narrativo|[âa]ngulo do roteiro|mude s[oó] o [âa]ngulo|troque s[oó] o [âa]ngulo)\b/i;

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
  } else if (EDITORIAL_WHAT_REGEX.test(prompt)) {
    target = { type: "editorial", field: "what_to_post" };
  } else if (EDITORIAL_WHY_REGEX.test(prompt)) {
    target = { type: "editorial", field: "why_post_this_way" };
  } else if (EDITORIAL_WHEN_REGEX.test(prompt)) {
    target = { type: "editorial", field: "when_to_post" };
  } else if (EDITORIAL_HOW_REGEX.test(prompt)) {
    target = { type: "editorial", field: "how_video_should_work" };
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
  if (target.type === "editorial") {
    if (target.field === "what_to_post") return 'Linha editorial "O que postar"';
    if (target.field === "why_post_this_way") return 'Linha editorial "Por que postar assim"';
    if (target.field === "when_to_post") return 'Linha editorial "Quando postar"';
    return 'Linha editorial "Como esse vídeo deve funcionar"';
  }
  return "Roteiro completo";
}
