import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { AdaptiveV2Preview } from "./AdaptiveV2Preview";
import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveAnswerKeyResult,
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "../../postCreationAdaptiveTypes";

const detection: PostCreationAdaptiveIntentDetection = {
  mode: "validate_pauta",
  confidence: 0.85,
  normalizedInput: "quero gravar um pov sobre rotina",
  originalInput: "Quero gravar um POV sobre rotina",
  detectedPauta: "rotina",
  objective: null,
  brandCategory: null,
  sourceComment: null,
  signals: ["quero gravar"],
  suggestedStage: "quiz",
};

const questions: PostCreationAdaptiveQuestion[] = [
  {
    id: "question-objective",
    mapKey: "objective",
    type: "strategic_choice",
    title: "Que reação essa pauta deveria puxar?",
    helper: "A intenção orienta a execução.",
    required: true,
    options: [
      {
        id: "comments",
        label: "Abrir conversa",
        reason: "Combina com identificação e pergunta simples.",
        recommended: true,
      },
      {
        id: "saves",
        label: "Gerar consulta depois",
        reason: "Combina com conteúdo prático.",
      },
    ],
  },
  {
    id: "question-format",
    mapKey: "format",
    type: "preference",
    title: "Qual formato cabe melhor agora?",
    helper: "O formato precisa caber na energia disponível.",
    required: true,
    options: [
      {
        id: "reels",
        label: "Reels simples",
        reason: "Bom quando a cena carrega a ideia.",
        recommended: true,
      },
      {
        id: "carousel",
        label: "Carrossel curto",
        reason: "Bom quando a ideia precisa de ordem.",
      },
    ],
  },
];

const answers: PostCreationAdaptiveAnswer[] = [
  {
    questionId: "question-objective",
    key: "objective",
    optionId: "comments",
    value: null,
  },
  {
    questionId: "question-format",
    key: "format",
    optionId: "reels",
    value: null,
  },
];

const answerKey: PostCreationAdaptiveAnswerKeyResult = {
  mode: "validate_pauta",
  totalQuestions: 2,
  answeredQuestions: 2,
  recommendedMatches: 2,
  evaluations: [
    {
      questionId: "question-objective",
      key: "objective",
      selectedOptionId: "comments",
      selectedLabel: "Abrir conversa",
      recommendedOptionId: "comments",
      recommendedLabel: "Abrir conversa",
      isRecommendedChoice: true,
      reason: "Essa escolha mantém a pauta consultiva e clara.",
    },
    {
      questionId: "question-format",
      key: "format",
      selectedOptionId: "reels",
      selectedLabel: "Reels simples",
      recommendedOptionId: "reels",
      recommendedLabel: "Reels simples",
      isRecommendedChoice: true,
      reason: "Esse formato ajuda a transformar a cena em narrativa.",
    },
  ],
  strengths: ["Ponto forte: Abrir conversa.", "Ponto forte: Reels simples."],
  adjustments: [],
  summary: "A leitura aponta uma direção clara para transformar a rotina em pauta.",
};

const planWithoutMatches: PostCreationStrategicPlan = {
  pauta: "rotina",
  objective: "Abrir conversa",
  narrative: "Cena cotidiana com ponto de vista",
  format: "Reels simples",
  hook: "POV que entra direto na rotina",
  cta: "Perguntar quem também vive isso",
  fiveW2H: {
    who: "Audiência do Instagram",
    what: "rotina",
    where: "Instagram",
    when: "Próxima janela de publicação",
    why: "A pauta aproxima a audiência de uma cena reconhecível.",
    how: "Reels simples com narrativa cotidiana.",
    howMuch: "Baixo esforço",
  },
  scenes: [
    {
      id: "scene-1",
      title: "Gancho visual",
      visual: "Começar no meio da rotina.",
      message: "Mostrar a tensão principal sem explicar demais.",
    },
    {
      id: "scene-2",
      title: "Fechamento",
      visual: "Encerrar com olhar direto para a câmera.",
      message: "Abrir conversa com uma pergunta natural.",
    },
  ],
  brandMatch: null,
  collabMatch: null,
  nextActions: ["Revisar o roteiro.", "Separar elementos visuais.", "Observar a resposta da audiência."],
};

function renderPreview(plan: PostCreationStrategicPlan = planWithoutMatches) {
  return render(
    <AdaptiveV2Preview
      detection={detection}
      questions={questions}
      answers={answers}
      answerKey={answerKey}
      plan={plan}
    />
  );
}

describe("AdaptiveV2Preview", () => {
  it("renders the complete isolated preview", () => {
    renderPreview();

    expect(screen.getByText("Leitura inicial")).toBeInTheDocument();
    expect(screen.getByText("Caminhos de decisão")).toBeInTheDocument();
    expect(screen.getByText("Leitura da rodada")).toBeInTheDocument();
    expect(screen.getByText("Plano estratégico")).toBeInTheDocument();
  });

  it("does not render proof or game language", () => {
    const { container } = renderPreview();
    const text = container.textContent?.toLowerCase() || "";

    for (const forbidden of [
      "acerto",
      "acertou",
      "erro",
      "errou",
      "errado",
      "nota",
      "pontuação",
      "venceu",
      "perdeu",
      "resposta correta",
      "gabarito",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not render visual score language", () => {
    const { container } = renderPreview();
    const text = container.textContent?.toLowerCase() || "";

    expect(text).not.toContain("%");
    expect(text).not.toContain("score");
    expect(text).not.toContain("nota");
    expect(text).not.toContain("pontuação");
  });

  it("renders brand match only when present", () => {
    const { rerender } = renderPreview();

    expect(screen.queryByText("Encaixe com marca")).not.toBeInTheDocument();

    rerender(
      <AdaptiveV2Preview
        detection={detection}
        questions={questions}
        answers={answers}
        answerKey={answerKey}
        plan={{
          ...planWithoutMatches,
          brandMatch: {
            enabled: true,
            category: "skincare",
            angle: "Rotina real com produto em contexto.",
            desiredBrandSignals: ["uso natural"],
          },
        }}
      />
    );

    expect(screen.getByText("Encaixe com marca")).toBeInTheDocument();
    expect(screen.getByText(/skincare/i)).toBeInTheDocument();
  });

  it("renders collab match only when present", () => {
    const { rerender } = renderPreview();

    expect(screen.queryByText("Encaixe com collab")).not.toBeInTheDocument();

    rerender(
      <AdaptiveV2Preview
        detection={detection}
        questions={questions}
        answers={answers}
        answerKey={answerKey}
        plan={{
          ...planWithoutMatches,
          collabMatch: {
            enabled: true,
            creatorProfile: "Creator do mesmo nicho",
            collaborationAngle: "Contraste de rotina",
          },
        }}
      />
    );

    expect(screen.getByText("Encaixe com collab")).toBeInTheDocument();
    expect(screen.getByText(/Creator do mesmo nicho/i)).toBeInTheDocument();
  });

  it("keeps preview components isolated from product flow dependencies", () => {
    const previewDir = __dirname;
    const source = fs
      .readdirSync(previewDir)
      .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
      .map((file) => fs.readFileSync(path.join(previewDir, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/BoardShell|PostCreationFunnelBoardShell/);
    expect(source).not.toMatch(/postCreationAdaptiveRouter|postCreationAdaptiveQuizBuilder/);
    expect(source).not.toMatch(/postCreationAdaptiveAnswerKey|postCreationAdaptivePlanBuilder/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/OpenAI|openai/i);
    expect(source).not.toMatch(/\bwindow\b|localStorage/);
  });
});
