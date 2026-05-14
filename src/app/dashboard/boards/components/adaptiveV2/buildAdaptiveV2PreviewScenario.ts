import { buildPostCreationAdaptiveAnswerKey } from "../../postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveStrategicPlan } from "../../postCreationAdaptivePlanBuilder";
import { buildPostCreationAdaptiveQuiz } from "../../postCreationAdaptiveQuizBuilder";
import { detectPostCreationAdaptiveIntent } from "../../postCreationAdaptiveRouter";
import type { PostCreationAdaptiveAnswer } from "../../postCreationAdaptiveTypes";

export type AdaptiveV2PreviewScenario = {
  id: string;
  label: string;
  input: string;
};

export const ADAPTIVE_V2_PREVIEW_SCENARIOS: AdaptiveV2PreviewScenario[] = [
  {
    id: "validate-pauta",
    label: "Validar pauta",
    input: "Quero gravar um POV sobre rotina",
  },
  {
    id: "format-guidance",
    label: "Escolher formato",
    input: "Qual formato usar para uma publi de skincare?",
  },
  {
    id: "discover-pauta",
    label: "Descobrir pauta",
    input: "Não sei o que postar amanhã",
  },
  {
    id: "brand-match",
    label: "Match com marca",
    input: "Quero atrair marcas de skincare",
  },
  {
    id: "collab-match",
    label: "Match com collab",
    input: "Quero fazer uma collab para gerar comentários",
  },
  {
    id: "comment-to-post",
    label: "Comentário vira post",
    input: "Comentaram isso aqui: como você organiza sua rotina?",
  },
];

export const DEFAULT_ADAPTIVE_V2_PREVIEW_SCENARIO_ID = "validate-pauta";

function normalizeScenarioId(value?: string | string[] | null) {
  if (Array.isArray(value)) return value[0] || DEFAULT_ADAPTIVE_V2_PREVIEW_SCENARIO_ID;
  return value || DEFAULT_ADAPTIVE_V2_PREVIEW_SCENARIO_ID;
}

export function getAdaptiveV2PreviewScenario(value?: string | string[] | null) {
  const scenarioId = normalizeScenarioId(value);
  return (
    ADAPTIVE_V2_PREVIEW_SCENARIOS.find((scenario) => scenario.id === scenarioId) ||
    ADAPTIVE_V2_PREVIEW_SCENARIOS[0]!
  );
}

export function buildAdaptiveV2PreviewScenario(value?: string | string[] | null) {
  const scenario = getAdaptiveV2PreviewScenario(value);
  const detection = detectPostCreationAdaptiveIntent(scenario.input);
  const questions = buildPostCreationAdaptiveQuiz({ detection });
  const answers: PostCreationAdaptiveAnswer[] = questions.map((question) => ({
    questionId: question.id,
    key: question.mapKey,
    optionId: question.options.find((option) => option.recommended)?.id || question.options[0]!.id,
    value: null,
  }));
  const answerKey = buildPostCreationAdaptiveAnswerKey({ detection, questions, answers });
  const plan = buildPostCreationAdaptiveStrategicPlan({ detection, questions, answers, answerKey });

  return {
    scenario,
    detection,
    questions,
    answers,
    answerKey,
    plan,
  };
}
