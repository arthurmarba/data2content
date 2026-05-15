import {
  buildPostCreationVideoSeedFromAnalysis,
  getPostCreationVideoSeedPrimaryAction,
  hasUsefulPostCreationVideoSeed,
} from "../../videoUpload/videoNarrativePostCreationSeed";
import {
  VideoNarrativeMockProviderScenario,
  runVideoNarrativeMockProvider,
} from "../../videoUpload/videoNarrativeMockProvider";
import {
  getVideoNarrativeSuggestedNextStep,
  hasUsefulVideoNarrativeAnalysis,
} from "../../videoUpload/videoNarrativeAnalysisTypes";

export type VideoNarrativePreviewScenario = {
  id: string;
  label: string;
  creatorQuestion: string;
  mockScenario: VideoNarrativeMockProviderScenario;
};

export const VIDEO_NARRATIVE_PREVIEW_SCENARIOS: VideoNarrativePreviewScenario[] = [
  {
    id: "skincare",
    label: "Narrativa: rotina de skincare",
    creatorQuestion: "Quero saber se vale postar",
    mockScenario: "skincare_routine",
  },
  {
    id: "backstage",
    label: "Narrativa: bastidor de criação",
    creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
    mockScenario: "backstage_process",
  },
  {
    id: "brand",
    label: "Narrativa: potencial de marca",
    creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
    mockScenario: "brand_potential",
  },
  {
    id: "weak-hook",
    label: "Narrativa: gancho fraco",
    creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
    mockScenario: "weak_hook",
  },
  {
    id: "collab",
    label: "Narrativa: potencial de collab",
    creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
    mockScenario: "collab_potential",
  },
  {
    id: "ad-adaptation",
    label: "Narrativa: adaptação para publi",
    creatorQuestion: "Quero transformar esse vídeo em uma publi sem parecer forçado",
    mockScenario: "ad_adaptation",
  },
  {
    id: "unclear",
    label: "Narrativa: contexto insuficiente",
    creatorQuestion: "Me ajuda com esse vídeo",
    mockScenario: "unclear_content",
  },
];

export const DEFAULT_VIDEO_NARRATIVE_PREVIEW_SCENARIO_ID = "skincare";

function normalizeScenarioId(value?: string | string[] | null) {
  if (Array.isArray(value)) return value[0] || DEFAULT_VIDEO_NARRATIVE_PREVIEW_SCENARIO_ID;
  return value || DEFAULT_VIDEO_NARRATIVE_PREVIEW_SCENARIO_ID;
}

export function getVideoNarrativePreviewScenario(value?: string | string[] | null) {
  const scenarioId = normalizeScenarioId(value);
  return (
    VIDEO_NARRATIVE_PREVIEW_SCENARIOS.find((scenario) => scenario.id === scenarioId) ||
    VIDEO_NARRATIVE_PREVIEW_SCENARIOS[0]!
  );
}

export function buildVideoNarrativePreviewScenario(value?: string | string[] | null) {
  const scenario = getVideoNarrativePreviewScenario(value);
  const analysis = runVideoNarrativeMockProvider({
    input: {
      id: `video-narrative-preview-${scenario.id}`,
      creatorQuestion: scenario.creatorQuestion,
      createdAt: "2026-05-15T10:00:00.000Z",
    },
    options: { scenario: scenario.mockScenario },
  });
  const seed = buildPostCreationVideoSeedFromAnalysis({
    id: `video-narrative-preview-${scenario.id}-seed`,
    analysis,
    creatorQuestion: scenario.creatorQuestion,
    createdAt: analysis.createdAt,
  });

  return {
    scenario,
    analysis,
    hasUsefulAnalysis: hasUsefulVideoNarrativeAnalysis(analysis),
    seed,
    hasUsefulSeed: hasUsefulPostCreationVideoSeed(seed),
    primaryAction: getPostCreationVideoSeedPrimaryAction(seed),
    suggestedNextStep: getVideoNarrativeSuggestedNextStep(analysis),
  };
}
