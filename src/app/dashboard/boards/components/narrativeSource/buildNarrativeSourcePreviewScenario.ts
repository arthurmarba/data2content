import { buildPostCreationAdaptiveAnswerKey } from "../../postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveStrategicPlan } from "../../postCreationAdaptivePlanBuilder";
import { buildPostCreationAdaptiveQuiz } from "../../postCreationAdaptiveQuizBuilder";
import { detectPostCreationAdaptiveIntent } from "../../postCreationAdaptiveRouter";
import type { PostCreationAdaptiveAnswer } from "../../postCreationAdaptiveTypes";
import { extractNarrativeAssets } from "../../narrativeSource/narrativeAssetExtractor";
import { buildAdaptiveInputFromNarrativeSource } from "../../narrativeSource/narrativeSourceAdaptiveAdapter";
import { detectNarrativeSourceIntent } from "../../narrativeSource/narrativeSourceIntentRouter";
import { createEmptyNarrativeSource, type NarrativeSource } from "../../narrativeSource/narrativeSourceTypes";

export type NarrativeSourcePreviewScenario = {
  id: string;
  label: string;
  source: NarrativeSource;
};

function source(params: Partial<NarrativeSource> & Pick<NarrativeSource, "sourceType">): NarrativeSource {
  return {
    ...createEmptyNarrativeSource({
      id: params.id || `nse-preview-${params.sourceType}`,
      sourceType: params.sourceType,
    }),
    ...params,
    metadata: params.metadata || {},
  };
}

export const NARRATIVE_SOURCE_PREVIEW_SCENARIOS: NarrativeSourcePreviewScenario[] = [
  {
    id: "video-validate",
    label: "Vídeo: validar antes de postar",
    source: source({
      id: "nse-preview-video-validate",
      sourceType: "video_simulated",
      creatorQuestion: "Gravei esse vídeo e quero saber se vale postar",
      transcript: "Mostro minha rotina de skincare pela manhã com cuidado e autocuidado.",
      visualDescription: "Pessoa organizando produtos de skincare na bancada.",
      metadata: {
        title: "Rotina de skincare da manhã",
        format: "reel",
        platform: "instagram",
      },
    }),
  },
  {
    id: "video-brand-potential",
    label: "Vídeo: potencial de marca",
    source: source({
      id: "nse-preview-video-brand-potential",
      sourceType: "video_simulated",
      creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
      transcript: "Mostro minha rotina de skincare e autocuidado pela manhã.",
      visualDescription: "Bancada com produtos de cuidado pessoal em uso real.",
      metadata: {
        title: "Rotina real com skincare",
        format: "reel",
        platform: "instagram",
        campaignContext: "autocuidado",
      },
    }),
  },
  {
    id: "video-discover-narrative",
    label: "Vídeo: descobrir narrativa",
    source: source({
      id: "nse-preview-video-discover-narrative",
      sourceType: "video_simulated",
      creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
      transcript: "Bastidor do processo de produção e organização do trabalho.",
      visualDescription: "Mesa com roteiro, gravação e cenas de bastidor.",
      metadata: {
        title: "Bastidor de produção",
        format: "short_video",
        platform: "instagram",
      },
    }),
  },
  {
    id: "video-improve-content",
    label: "Vídeo: melhorar gancho",
    source: source({
      id: "nse-preview-video-improve-content",
      sourceType: "video_simulated",
      creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
      rawText: "Bastidor de trabalho mostrando processo e gravação.",
      transcript: "Mostro uma reunião e o processo de produção do conteúdo.",
      metadata: {
        title: "Processo criativo em bastidor",
        format: "reel",
        platform: "instagram",
      },
    }),
  },
  {
    id: "video-collab",
    label: "Vídeo: collab",
    source: source({
      id: "nse-preview-video-collab",
      sourceType: "video_simulated",
      creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
      rawText: "Bastidor de trabalho com processo de produção e decisões criativas.",
      metadata: {
        title: "Bastidor para collab",
        format: "reel",
        platform: "instagram",
      },
    }),
  },
  {
    id: "comment-to-post",
    label: "Comentário vira post",
    source: source({
      id: "nse-preview-comment-to-post",
      sourceType: "comment",
      rawText: "Comentaram isso aqui: como você organiza sua rotina? Me perguntaram no direct.",
      metadata: {
        platform: "instagram",
      },
    }),
  },
  {
    id: "script-to-plan",
    label: "Roteiro vira plano",
    source: source({
      id: "nse-preview-script-to-plan",
      sourceType: "script",
      creatorQuestion: "Quero saber se vale postar esse roteiro",
      rawText: "Roteiro sobre bastidor de reunião, trabalho e processo de produção.",
      metadata: {
        title: "Roteiro de bastidor",
        format: "reel",
        platform: "instagram",
      },
    }),
  },
];

export const DEFAULT_NARRATIVE_SOURCE_PREVIEW_SCENARIO_ID = "video-validate";

function normalizeScenarioId(value?: string | string[] | null) {
  if (Array.isArray(value)) return value[0] || DEFAULT_NARRATIVE_SOURCE_PREVIEW_SCENARIO_ID;
  return value || DEFAULT_NARRATIVE_SOURCE_PREVIEW_SCENARIO_ID;
}

export function getNarrativeSourcePreviewScenario(value?: string | string[] | null) {
  const scenarioId = normalizeScenarioId(value);
  return (
    NARRATIVE_SOURCE_PREVIEW_SCENARIOS.find((scenario) => scenario.id === scenarioId) ||
    NARRATIVE_SOURCE_PREVIEW_SCENARIOS[0]!
  );
}

export function buildNarrativeSourcePreviewScenario(value?: string | string[] | null) {
  const scenario = getNarrativeSourcePreviewScenario(value);
  const sourceIntent = detectNarrativeSourceIntent(scenario.source);
  const extraction = extractNarrativeAssets({ source: scenario.source, intentDetection: sourceIntent });
  const adaptiveInput = buildAdaptiveInputFromNarrativeSource({
    source: scenario.source,
    intentDetection: sourceIntent,
    extraction,
  });
  const adaptiveDetection = detectPostCreationAdaptiveIntent(adaptiveInput.input);
  const questions = buildPostCreationAdaptiveQuiz({ detection: adaptiveDetection });
  const answers: PostCreationAdaptiveAnswer[] = questions.map((question) => ({
    questionId: question.id,
    key: question.mapKey,
    optionId: question.options.find((option) => option.recommended)?.id || question.options[0]!.id,
    value: null,
  }));
  const answerKey = buildPostCreationAdaptiveAnswerKey({ detection: adaptiveDetection, questions, answers });
  const plan = buildPostCreationAdaptiveStrategicPlan({
    detection: adaptiveDetection,
    questions,
    answers,
    answerKey,
  });

  return {
    scenario,
    source: scenario.source,
    sourceIntent,
    extraction,
    adaptiveInput,
    adaptiveDetection,
    questions,
    answers,
    answerKey,
    plan,
  };
}
