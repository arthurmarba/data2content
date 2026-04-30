import type { PostCreationBlueprint, PostCreationBlueprintScene } from "./postCreationFunnel";

export type PostCreationBlueprintAdjustment =
  | "simplify"
  | "direct"
  | "question_cta"
  | "rotate_narrative"
  | "reset";

type AdjustBlueprintOptions = {
  recommendedBlueprint?: PostCreationBlueprint | null;
};

const NARRATIVE_PRESETS = [
  {
    matchers: ["erro", "ajuste", "prova"],
    howItShouldWork: "erro visível -> ajuste simples -> prova -> pergunta final",
    titles: ["Gancho", "Contexto", "Virada prática", "Fechamento"],
  },
  {
    matchers: ["situação", "criterio", "exemplo"],
    howItShouldWork: "situação real -> critério prático -> exemplo -> pergunta final",
    titles: ["Situação real", "Critério", "Exemplo", "Fechamento"],
  },
  {
    matchers: ["quebra", "prova", "pergunta"],
    howItShouldWork: "quebra de expectativa -> ajuste -> prova rápida -> pergunta final",
    titles: ["Quebra de expectativa", "Ajuste", "Prova rápida", "Fechamento"],
  },
] as const;

function cloneBlueprintScene(scene: PostCreationBlueprintScene): PostCreationBlueprintScene {
  return {
    id: scene.id,
    title: scene.title,
    visual: scene.visual,
    message: scene.message,
    direction: scene.direction,
    rationale: scene.rationale,
  };
}

function cloneBlueprint(blueprint: PostCreationBlueprint): PostCreationBlueprint {
  return {
    whatToPost: blueprint.whatToPost,
    whyThisPath: blueprint.whyThisPath,
    whenToPost: blueprint.whenToPost,
    howItShouldWork: blueprint.howItShouldWork,
    scenes: blueprint.scenes.map(cloneBlueprintScene),
  };
}

function truncateText(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const sliced = normalized.slice(0, maxChars).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.7 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}...`;
}

function simplifyText(value: string, maxChars: number) {
  const normalized = value
    .replace(/\b(deixando claro|sem enrolar|de forma|na prática)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return truncateText(normalized, maxChars);
}

function resolveNextNarrativePreset(current: string) {
  const normalized = current.toLowerCase();
  const currentIndex = NARRATIVE_PRESETS.findIndex((preset) =>
    preset.matchers.every((matcher) => normalized.includes(matcher))
  );
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % NARRATIVE_PRESETS.length : 1;
  return NARRATIVE_PRESETS[nextIndex]!;
}

export function adjustBlueprint(
  blueprint: PostCreationBlueprint,
  adjustment: PostCreationBlueprintAdjustment,
  options?: AdjustBlueprintOptions
): PostCreationBlueprint {
  if (adjustment === "reset" && options?.recommendedBlueprint) {
    return cloneBlueprint(options.recommendedBlueprint);
  }

  const next = cloneBlueprint(blueprint);

  if (adjustment === "simplify") {
    next.whyThisPath = simplifyText(next.whyThisPath, 120);
    next.howItShouldWork = simplifyText(next.howItShouldWork, 84);
    next.scenes = next.scenes.map((scene) => ({
      ...scene,
      visual: simplifyText(scene.visual, 88),
      message: simplifyText(scene.message, 86),
      direction: simplifyText(scene.direction, 76),
      rationale: simplifyText(scene.rationale, 88),
    }));
    return next;
  }

  if (adjustment === "direct") {
    next.howItShouldWork = "tese direta -> prova rápida -> ajuste -> pergunta final";
    next.scenes = next.scenes.map((scene, index) => {
      if (index === 0) {
        return {
          ...scene,
          message: "Abrir com a tese central em uma frase curta, sem aquecimento.",
          direction: "Direto, firme e sem contexto antes da virada.",
          rationale: "Abertura assertiva reduz dispersão logo no começo.",
        };
      }
      return scene;
    });
    return next;
  }

  if (adjustment === "question_cta") {
    next.scenes = next.scenes.map((scene, index) => {
      if (index !== next.scenes.length - 1) return scene;
      return {
        ...scene,
        message: `Fechar com uma pergunta específica sobre ${truncateText(next.whatToPost.toLowerCase(), 44)}.`,
        direction: "Tom conversado, deixando espaço para resposta útil.",
        rationale: "Pergunta específica tende a gerar comentário melhor do que CTA genérico.",
      };
    });
    return next;
  }

  if (adjustment === "rotate_narrative") {
    const preset = resolveNextNarrativePreset(next.howItShouldWork);
    next.howItShouldWork = preset.howItShouldWork;
    next.scenes = next.scenes.map((scene, index) => {
      const title = preset.titles[index] || scene.title;
      if (index === 0) {
        return {
          ...scene,
          title,
          message:
            preset.titles[0] === "Quebra de expectativa"
              ? "Abrir quebrando a expectativa antes de explicar o ponto."
              : scene.message,
        };
      }
      if (index === 1) {
        return {
          ...scene,
          title,
          message:
            preset.titles[1] === "Critério"
              ? "Mostrar o critério simples que separa o acerto do erro."
              : preset.titles[1] === "Ajuste"
                ? "Entrar rápido no ajuste que muda o resultado."
                : scene.message,
        };
      }
      if (index === 2) {
        return {
          ...scene,
          title,
          message:
            preset.titles[2] === "Exemplo"
              ? "Mostrar um exemplo curto que torne o critério visível."
              : preset.titles[2] === "Prova rápida"
                ? "Trazer uma prova curta que sustente o ajuste."
                : scene.message,
        };
      }
      return {
        ...scene,
        title,
      };
    });
    return next;
  }

  return next;
}
