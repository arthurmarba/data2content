import type { PostCreationStrategicPlan } from "./postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationBlueprintScene,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "./postCreationFunnel";

function cleanText(value?: string | null): string | null {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : null;
}

function nonEmpty(value: string | null | undefined, fallback: string): string {
  return cleanText(value) || fallback;
}

export function normalizeAdaptiveSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return normalized || "adaptive_plan";
}

function getPlanCorpus(plan: PostCreationStrategicPlan): string {
  return [
    plan.pauta,
    plan.objective,
    plan.narrative,
    plan.format,
    plan.hook,
    plan.cta,
    plan.fiveW2H?.why,
    plan.fiveW2H?.how,
    plan.brandMatch?.category,
    plan.brandMatch?.angle,
    plan.collabMatch?.creatorProfile,
    plan.collabMatch?.collaborationAngle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAny(corpus: string, values: string[]): boolean {
  return values.some((value) => corpus.includes(value));
}

function inferContextId(plan: PostCreationStrategicPlan): string {
  const corpus = getPlanCorpus(plan);
  if (plan.brandMatch?.enabled) return "brand_match";
  if (plan.collabMatch?.enabled) return "collab";
  if (hasAny(corpus, ["comentario", "comentarios", "engajamento", "engajar", "comunidade"])) {
    return "community";
  }
  return "content_strategy";
}

function inferProposalId(plan: PostCreationStrategicPlan): string {
  const corpus = getPlanCorpus(plan);
  if (plan.brandMatch?.enabled || hasAny(corpus, ["marca", "publi", "publicidade", "patrocinio"])) {
    return "publi_divulgation";
  }
  if (plan.collabMatch?.enabled || hasAny(corpus, ["collab", "colab", "participacao"])) {
    return "participation";
  }
  if (hasAny(corpus, ["humor", "pov", "cena", "reacao"])) {
    return "humor_scene";
  }
  if (hasAny(corpus, ["comentario", "pergunta", "duvida", "q&a", "resposta"])) {
    return "q&a";
  }
  return "tips";
}

function inferToneId(plan: PostCreationStrategicPlan): string {
  const corpus = getPlanCorpus(plan);
  if (hasAny(corpus, ["humor", "pov", "cena", "reacao"])) return "humorous";
  if (plan.brandMatch?.enabled || hasAny(corpus, ["marca", "comercial", "publi"])) return "commercial";
  if (hasAny(corpus, ["tutorial", "dica", "educa", "pratico", "passo"])) return "educational";
  return "neutral";
}

function inferReferenceId(plan: PostCreationStrategicPlan): string | null {
  const corpus = getPlanCorpus(plan);
  if (hasAny(corpus, ["pov"])) return "pov";
  if (hasAny(corpus, ["comentario", "pergunta", "duvida", "audiencia"])) return "audience_comment";
  return null;
}

function inferIntentId(plan: PostCreationStrategicPlan): string {
  const corpus = getPlanCorpus(plan);
  if (plan.brandMatch?.enabled || hasAny(corpus, ["marca", "publi", "patrocinio"])) return "atrair_marcas";
  if (plan.collabMatch?.enabled || hasAny(corpus, ["collab", "colab"])) return "collab";
  if (hasAny(corpus, ["vender", "venda", "converter", "clique", "cliques"])) return "converter";
  if (hasAny(corpus, ["alcance", "crescer", "seguidores"])) return "alcance";
  if (hasAny(corpus, ["comentario", "comentarios", "engajamento", "engajar"])) return "engajar";
  return "engajar";
}

function inferFormatId(plan: PostCreationStrategicPlan): string {
  const corpus = getPlanCorpus(plan);
  if (hasAny(corpus, ["carrossel", "carousel"])) return "carousel";
  if (hasAny(corpus, ["story", "stories"])) return "story";
  if (hasAny(corpus, ["foto", "photo"])) return "photo";
  if (hasAny(corpus, ["reels", "reel", "video"])) return "reel";
  return "reel";
}

function inferDurationId(formatId: string): string | null {
  if (formatId === "carousel" || formatId === "photo") return null;
  if (formatId === "reel" || formatId === "story") return "15-30s";
  return "15-30s";
}

function buildSyntheticPautaId(plan: PostCreationStrategicPlan): string {
  const base = normalizeAdaptiveSlug(nonEmpty(plan.pauta, "adaptive_plan")).slice(0, 72);
  return `adaptive_${base || "plan"}`;
}

function summarizePlan(plan: PostCreationStrategicPlan): string {
  const objective = nonEmpty(plan.objective, "engajar a audiencia");
  const narrative = nonEmpty(plan.narrative, "estrategia adaptativa");
  return `Objetivo: ${objective}. Narrativa: ${narrative}.`;
}

function buildLegacyIdea(plan: PostCreationStrategicPlan, pautaId: string): PostCreationIdeaVariant {
  const evidence = [
    `Objetivo: ${nonEmpty(plan.objective, "engajar a audiencia")}`,
    `Narrativa: ${nonEmpty(plan.narrative, "estrategia adaptativa")}`,
    `CTA: ${nonEmpty(plan.cta, "pergunta especifica")}`,
    plan.brandMatch?.enabled
      ? `Marca: ${nonEmpty(plan.brandMatch.category, "categoria comercial")}`
      : null,
    plan.collabMatch?.enabled
      ? `Collab: ${nonEmpty(plan.collabMatch.creatorProfile, "creator parceiro")}`
      : null,
  ].filter(Boolean) as string[];

  return {
    id: pautaId,
    title: nonEmpty(plan.pauta, "Pauta adaptativa"),
    description: summarizePlan(plan),
    lane: "recommended",
    source: "ai_idea",
    confidence: 0.72,
    evidence: evidence.slice(0, 4),
  };
}

function buildFallbackScenes(plan: PostCreationStrategicPlan): PostCreationBlueprintScene[] {
  const pauta = nonEmpty(plan.pauta, "pauta adaptativa");
  const hook = nonEmpty(plan.hook, "Abrir com a tensao principal da pauta");
  const cta = nonEmpty(plan.cta, "Fechar com pergunta especifica");

  return [
    {
      id: "adaptive-scene-1",
      title: "Gancho",
      visual: "Close ou primeira tela com contexto imediato.",
      message: hook,
      direction: "Abrir rapido, sem explicar demais antes da tensao.",
      rationale: "O gancho precisa tornar a pauta reconhecivel nos primeiros segundos.",
    },
    {
      id: "adaptive-scene-2",
      title: "Contexto",
      visual: "Mostrar a situacao ou exemplo que sustenta a pauta.",
      message: pauta,
      direction: "Conectar o assunto a uma cena concreta.",
      rationale: "Contexto visivel reduz abstracao e aumenta identificacao.",
    },
    {
      id: "adaptive-scene-3",
      title: "Desenvolvimento",
      visual: "Trazer criterio, virada, exemplo ou demonstracao.",
      message: nonEmpty(plan.fiveW2H?.how, "Executar a narrativa com clareza."),
      direction: "Manter ritmo pratico e uma ideia por bloco.",
      rationale: "A virada transforma a pauta em valor para a audiencia.",
    },
    {
      id: "adaptive-scene-4",
      title: "Fechamento",
      visual: "Voltar para camera ou texto final na tela.",
      message: cta,
      direction: "Fechar com acao simples e facil de responder.",
      rationale: "CTA especifico aumenta continuidade da conversa.",
    },
  ];
}

function convertPlanSceneToBlueprintScene(
  scene: PostCreationStrategicPlan["scenes"][number],
  index: number,
  plan: PostCreationStrategicPlan
): PostCreationBlueprintScene {
  const fallback = buildFallbackScenes(plan)[Math.min(index, 3)]!;
  return {
    id: cleanText(scene.id) || `adaptive-scene-${index + 1}`,
    title: nonEmpty(scene.title, fallback.title),
    visual: nonEmpty(scene.visual, fallback.visual),
    message: nonEmpty(scene.message, fallback.message),
    direction: nonEmpty(scene.direction, fallback.direction),
    rationale:
      index === 0
        ? "Esta abertura traduz o plano adaptativo em gancho gravavel."
        : index === 1
          ? "Este bloco cria contexto suficiente para a audiencia entender a pauta."
          : index === 2
            ? "Este bloco entrega a virada pratica da narrativa."
            : "Este bloco fecha a acao esperada do conteudo.",
  };
}

function buildLegacyBlueprint(plan: PostCreationStrategicPlan): PostCreationBlueprint {
  const sourceScenes = Array.isArray(plan.scenes) ? plan.scenes : [];
  const scenes =
    sourceScenes.length > 0
      ? sourceScenes.slice(0, 5).map((scene, index) => convertPlanSceneToBlueprintScene(scene, index, plan))
      : buildFallbackScenes(plan);

  return {
    whatToPost: nonEmpty(plan.pauta, "Pauta adaptativa"),
    whyThisPath: `${nonEmpty(plan.fiveW2H?.why, "Esta pauta tem potencial estrategico.")} ${summarizePlan(plan)}`,
    whenToPost: nonEmpty(plan.fiveW2H?.when, "Proxima janela viavel de postagem"),
    howItShouldWork: `${nonEmpty(plan.fiveW2H?.how, "Executar com clareza e ritmo.")} Gancho: ${nonEmpty(
      plan.hook,
      "abrir com a tensao principal"
    )}. CTA: ${nonEmpty(plan.cta, "pergunta especifica")}.`,
    scenes: scenes.length >= 3 ? scenes : buildFallbackScenes(plan),
  };
}

function buildDecision(plan: PostCreationStrategicPlan, pautaId: string): PostCreationDecisionState {
  const formatId = inferFormatId(plan);
  return {
    contextId: inferContextId(plan),
    proposalId: inferProposalId(plan),
    toneId: inferToneId(plan),
    referenceId: inferReferenceId(plan),
    intentId: inferIntentId(plan),
    formatId,
    durationId: inferDurationId(formatId),
    narrativeId: nonEmpty(plan.narrative, "estrategia_adaptativa"),
    dayId: null,
    hourId: null,
    themeId: normalizeAdaptiveSlug(nonEmpty(plan.pauta, "adaptive_plan")),
    pautaId,
  };
}

export function buildPostCreationLegacyHandoff(params: {
  plan: PostCreationStrategicPlan;
}): {
  decision: PostCreationDecisionState;
  idea: PostCreationIdeaVariant;
  blueprint: PostCreationBlueprint;
} {
  const pautaId = buildSyntheticPautaId(params.plan);

  return {
    decision: buildDecision(params.plan, pautaId),
    idea: buildLegacyIdea(params.plan, pautaId),
    blueprint: buildLegacyBlueprint(params.plan),
  };
}
