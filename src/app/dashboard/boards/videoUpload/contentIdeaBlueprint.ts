/**
 * Contrato visual do roteiro de pauta.
 *
 * V2 acrescenta direção de cena sem transformar a pauta em texto decorado. O
 * criador recebe o que mostrar, a intenção da fala e o texto de tela; a voz
 * continua sendo dele. O resolver mantém pautas antigas legíveis sem migração.
 */

export const CONTENT_IDEA_SCENE_BEATS = [
  "abertura",
  "contexto",
  "virada",
  "fechamento",
] as const;

export type ContentIdeaSceneBeat = (typeof CONTENT_IDEA_SCENE_BEATS)[number];

export interface ContentIdeaScene {
  beat: ContentIdeaSceneBeat;
  visual: string;
  spokenIntent: string;
  onScreenText: string | null;
  shot: string | null;
  asset: string | null;
  durationSeconds: number | null;
}

export interface ContentIdeaScriptBlueprint {
  version: 2;
  visualPremise: string;
  estimatedDurationSeconds: number | null;
  scenes: ContentIdeaScene[];
  recordingChecklist: string[];
}

export type CollabSceneOwner = "viewer" | "partner" | "both";

export interface ContentIdeaCollabScene {
  owner: CollabSceneOwner;
  beat: ContentIdeaSceneBeat;
  visual: string;
  spokenIntent: string;
  transition: string | null;
}

export interface ContentIdeaCollabBlueprint {
  version: 1;
  format: string;
  openingOwner: CollabSceneOwner;
  scenes: ContentIdeaCollabScene[];
  editPlan: string;
  handoffChecklist: string[];
}

const COLLAB_SCENE_OWNERS: CollabSceneOwner[] = ["viewer", "partner", "both"];

export interface LegacyContentIdeaScriptInput {
  hook: string;
  scriptPoints: string[];
  scriptClosing: string | null;
  assets?: string[];
}

function clean(value: unknown, max = 220): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function validBeat(value: unknown): ContentIdeaSceneBeat | null {
  return typeof value === "string" && CONTENT_IDEA_SCENE_BEATS.includes(value as ContentIdeaSceneBeat)
    ? value as ContentIdeaSceneBeat
    : null;
}

function duration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(180, Math.round(value)));
}

/** Sanitiza o payload do LLM ou o valor persistido no Mongo. */
export function sanitizeContentIdeaScriptBlueprint(
  raw: unknown,
  allowedAssets: string[] = [],
): ContentIdeaScriptBlueprint | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const visualPremise = clean(value.visualPremise, 180);
  if (!visualPremise || !Array.isArray(value.scenes)) return null;

  const scenes = value.scenes
    .map((scene): ContentIdeaScene | null => {
      if (!scene || typeof scene !== "object") return null;
      const item = scene as Record<string, unknown>;
      const beat = validBeat(item.beat);
      const visual = clean(item.visual, 180);
      const spokenIntent = clean(item.spokenIntent, 180);
      if (!beat || !visual || !spokenIntent) return null;
      const rawAsset = clean(item.asset, 100);
      const asset = rawAsset
        ? allowedAssets.find((allowed) => allowed.toLocaleLowerCase("pt-BR") === rawAsset.toLocaleLowerCase("pt-BR")) ?? null
        : null;
      return {
        beat,
        visual,
        spokenIntent,
        onScreenText: clean(item.onScreenText, 90),
        shot: clean(item.shot, 80),
        asset,
        durationSeconds: duration(item.durationSeconds),
      };
    })
    .filter((scene): scene is ContentIdeaScene => scene !== null)
    .slice(0, 4);

  if (scenes.length < 2) return null;

  const recordingChecklist = Array.isArray(value.recordingChecklist)
    ? value.recordingChecklist
        .map((item) => clean(item, 120))
        .filter((item): item is string => item !== null)
        .slice(0, 4)
    : [];

  return {
    version: 2,
    visualPremise,
    estimatedDurationSeconds: duration(value.estimatedDurationSeconds),
    scenes,
    recordingChecklist,
  };
}

/** Converte o roteiro legado numa composição visual consistente para a UI. */
export function buildLegacyContentIdeaBlueprint(
  input: LegacyContentIdeaScriptInput,
): ContentIdeaScriptBlueprint {
  const scenes: ContentIdeaScene[] = [];
  const firstAsset = input.assets?.[0] ?? null;

  if (input.hook.trim()) {
    scenes.push({
      beat: "abertura",
      visual: firstAsset ? `Comece mostrando ${firstAsset}` : "Comece em um enquadramento direto e próximo",
      spokenIntent: input.hook.trim(),
      onScreenText: null,
      shot: "plano próximo",
      asset: firstAsset,
      durationSeconds: null,
    });
  }

  input.scriptPoints.slice(0, 3).forEach((point, index) => {
    const isLast = index === input.scriptPoints.length - 1 && !input.scriptClosing;
    scenes.push({
      beat: isLast ? "virada" : "contexto",
      visual: point.trim(),
      spokenIntent: point.trim(),
      onScreenText: null,
      shot: null,
      asset: null,
      durationSeconds: null,
    });
  });

  if (input.scriptClosing?.trim()) {
    scenes.push({
      beat: "fechamento",
      visual: "Volte ao enquadramento inicial para fechar a ideia",
      spokenIntent: input.scriptClosing.trim(),
      onScreenText: null,
      shot: "plano próximo",
      asset: null,
      durationSeconds: null,
    });
  }

  return {
    version: 2,
    visualPremise: scenes[0]?.visual ?? "Conte a ideia a partir de uma cena real da sua rotina",
    estimatedDurationSeconds: null,
    scenes,
    recordingChecklist: [],
  };
}

export function resolveContentIdeaScriptBlueprint(
  blueprint: ContentIdeaScriptBlueprint | null | undefined,
  legacy: LegacyContentIdeaScriptInput,
): ContentIdeaScriptBlueprint {
  return sanitizeContentIdeaScriptBlueprint(blueprint, legacy.assets ?? [])
    ?? buildLegacyContentIdeaBlueprint(legacy);
}

export function sanitizeContentIdeaCollabBlueprint(raw: unknown): ContentIdeaCollabBlueprint | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const format = clean(value.format, 100);
  const editPlan = clean(value.editPlan, 180);
  const openingOwner = COLLAB_SCENE_OWNERS.includes(value.openingOwner as CollabSceneOwner)
    ? value.openingOwner as CollabSceneOwner
    : null;
  if (!format || !editPlan || !openingOwner || !Array.isArray(value.scenes)) return null;

  const scenes = value.scenes
    .map((scene): ContentIdeaCollabScene | null => {
      if (!scene || typeof scene !== "object") return null;
      const item = scene as Record<string, unknown>;
      const owner = COLLAB_SCENE_OWNERS.includes(item.owner as CollabSceneOwner)
        ? item.owner as CollabSceneOwner
        : null;
      const beat = validBeat(item.beat);
      const visual = clean(item.visual, 180);
      const spokenIntent = clean(item.spokenIntent, 180);
      if (!owner || !beat || !visual || !spokenIntent) return null;
      return {
        owner,
        beat,
        visual,
        spokenIntent,
        transition: clean(item.transition, 120),
      };
    })
    .filter((scene): scene is ContentIdeaCollabScene => scene !== null)
    .slice(0, 5);

  if (scenes.length < 3) return null;

  const handoffChecklist = Array.isArray(value.handoffChecklist)
    ? value.handoffChecklist
        .map((item) => clean(item, 120))
        .filter((item): item is string => item !== null)
        .slice(0, 4)
    : [];

  return { version: 1, format, openingOwner, scenes, editPlan, handoffChecklist };
}

export function buildLegacyCollabBlueprint(
  recordingIdea: string,
  mode: "presencial" | "remoto" | null | undefined,
): ContentIdeaCollabBlueprint {
  const remote = mode !== "presencial";
  return {
    version: 1,
    format: remote ? "Revezamento gravado à distância" : "Conversa gravada no mesmo espaço",
    openingOwner: "viewer",
    scenes: [
      {
        owner: "viewer",
        beat: "abertura",
        visual: remote ? "Grave a abertura olhando direto para a câmera" : "Abra a conversa com os dois no quadro",
        spokenIntent: recordingIdea,
        transition: remote ? "Termine deixando uma pergunta clara para o outro creator" : null,
      },
      {
        owner: "partner",
        beat: "virada",
        visual: remote ? "O outro creator responde no próprio ambiente" : "O outro creator assume a resposta",
        spokenIntent: "Traga o ponto de vista complementar que só o outro creator consegue sustentar",
        transition: remote ? "Use a pergunta anterior como corte entre os vídeos" : "Corte para a reação de quem abriu",
      },
      {
        owner: "both",
        beat: "fechamento",
        visual: remote ? "Una as duas conclusões em cortes alternados" : "Fechem a ideia juntos no mesmo plano",
        spokenIntent: "Mostrem onde os dois pontos de vista se encontram",
        transition: null,
      },
    ],
    editPlan: remote
      ? "Gravem em enquadramentos parecidos e juntem as partes em ordem de pergunta e resposta"
      : "Mantenham a conversa contínua e usem cortes apenas para destacar reação e virada",
    handoffChecklist: remote
      ? ["Combinar enquadramento e duração", "Enviar arquivos originais", "Definir quem monta a versão final"]
      : ["Combinar local e ordem das falas", "Gravar um plano dos dois", "Definir quem finaliza a edição"],
  };
}

export function resolveContentIdeaCollabBlueprint(
  blueprint: ContentIdeaCollabBlueprint | null | undefined,
  recordingIdea: string | null | undefined,
  mode: "presencial" | "remoto" | null | undefined,
): ContentIdeaCollabBlueprint | null {
  return sanitizeContentIdeaCollabBlueprint(blueprint)
    ?? (recordingIdea?.trim() ? buildLegacyCollabBlueprint(recordingIdea, mode) : null);
}
