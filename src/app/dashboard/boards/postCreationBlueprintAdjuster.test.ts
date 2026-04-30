import { adjustBlueprint } from "./postCreationBlueprintAdjuster";
import type { PostCreationBlueprint } from "./postCreationFunnel";

const baseBlueprint: PostCreationBlueprint = {
  whatToPost: "O erro que derruba sua retenção antes da dica",
  whyThisPath: "Formato reels direto com diagnóstico curto para aproveitar a janela mais forte do perfil.",
  whenToPost: "Qui, 19h",
  howItShouldWork: "erro visível -> ajuste simples -> prova -> pergunta final",
  scenes: [
    {
      id: "scene-1",
      title: "Gancho",
      visual: "Close no rosto com texto curto na tela.",
      message: "Abrir nomeando o erro logo no começo.",
      direction: "Direto e rápido.",
      rationale: "Gancho curto retém melhor.",
    },
    {
      id: "scene-2",
      title: "Contexto",
      visual: "Mostrar exemplo real.",
      message: "Contextualizar o erro em um caso observável.",
      direction: "Didático.",
      rationale: "Contexto visível evita abstração.",
    },
    {
      id: "scene-3",
      title: "Virada prática",
      visual: "Abrir bloco de notas com o ajuste.",
      message: "Entregar o ajuste principal.",
      direction: "Objetivo.",
      rationale: "Transforma em algo aplicável.",
    },
    {
      id: "scene-4",
      title: "Fechamento",
      visual: "Voltar para a câmera.",
      message: "Fechar com CTA curto.",
      direction: "Conversado.",
      rationale: "Pergunta final melhora comentário.",
    },
  ],
};

describe("adjustBlueprint", () => {
  it("simplifies the blueprint without removing its structure", () => {
    const adjusted = adjustBlueprint(baseBlueprint, "simplify");
    expect(adjusted.scenes).toHaveLength(4);
    expect(adjusted.howItShouldWork.length).toBeLessThanOrEqual(84);
  });

  it("makes the opening more direct", () => {
    const adjusted = adjustBlueprint(baseBlueprint, "direct");
    expect(adjusted.howItShouldWork).toContain("tese direta");
    expect(adjusted.scenes[0]?.message).toContain("tese central");
  });

  it("turns the ending into a question-based CTA", () => {
    const adjusted = adjustBlueprint(baseBlueprint, "question_cta");
    expect(adjusted.scenes[3]?.message).toContain("pergunta específica");
    expect(adjusted.scenes[3]?.direction).toContain("resposta útil");
  });

  it("rotates the narrative preset and updates scene titles", () => {
    const adjusted = adjustBlueprint(baseBlueprint, "rotate_narrative");
    expect(adjusted.howItShouldWork).toContain("situação real");
    expect(adjusted.scenes[0]?.title).toBe("Situação real");
    expect(adjusted.scenes[1]?.title).toBe("Critério");
  });

  it("resets back to the recommended blueprint", () => {
    const modified = adjustBlueprint(baseBlueprint, "direct");
    const reset = adjustBlueprint(modified, "reset", { recommendedBlueprint: baseBlueprint });
    expect(reset).toEqual(baseBlueprint);
  });
});
