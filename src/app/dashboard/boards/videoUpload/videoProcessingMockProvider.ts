import {
  VideoProcessingArtifacts,
  VideoTechnicalSignal,
} from "./videoProcessingArtifacts";
import {
  VideoProcessingTaskRequest,
  VideoProcessingTaskResult,
  VideoProcessingTaskType,
  buildMockVideoProcessingProviderCapabilities,
  createEmptyVideoProcessingTaskResult,
  markVideoProcessingTaskCompleted,
  markVideoProcessingTaskFailed,
  validateVideoProcessingTaskRequest,
} from "./videoProcessingProviderContracts";

export type VideoProcessingMockProviderScenario =
  | "skincare_routine"
  | "backstage_process"
  | "brand_ocr"
  | "hook_improvement"
  | "empty"
  | "failure";

export type VideoProcessingMockProviderOptions = {
  scenario?: VideoProcessingMockProviderScenario;
  completedAt?: string;
  failTasks?: VideoProcessingTaskType[];
};

const COMPLETED_MESSAGE = "Processamento simulado concluído.";
const FAILED_MESSAGE = "Processamento simulado indisponível para esta tarefa.";
const INSUFFICIENT_DATA_MESSAGE = "Solicitação simulada sem dados suficientes.";

function completedAtFor(request: VideoProcessingTaskRequest, options?: VideoProcessingMockProviderOptions): string {
  return options?.completedAt || request.createdAt;
}

function failedResult(params: {
  request: VideoProcessingTaskRequest;
  message: string;
  options?: VideoProcessingMockProviderOptions;
}): VideoProcessingTaskResult {
  return markVideoProcessingTaskFailed({
    result: createEmptyVideoProcessingTaskResult({ request: params.request }),
    message: params.message,
    completedAt: completedAtFor(params.request, params.options),
  });
}

function buildIssueMessage(request: VideoProcessingTaskRequest): string {
  const validation = validateVideoProcessingTaskRequest({
    request,
    capabilities: buildMockVideoProcessingProviderCapabilities(),
  });

  if (validation.issues.length === 0) return INSUFFICIENT_DATA_MESSAGE;

  return validation.issues.map((issue) => issue.message).join(" ");
}

function technicalSignal(type: VideoTechnicalSignal["type"], value: string, confidence: number | null): VideoTechnicalSignal {
  return {
    type,
    value,
    confidence,
  };
}

function artifactsForTask(
  taskType: VideoProcessingTaskType,
  scenario: VideoProcessingMockProviderScenario,
): Partial<VideoProcessingArtifacts> {
  if (scenario === "empty") return {};

  if (scenario === "skincare_routine") {
    if (taskType === "transcription") {
      return {
        transcript: {
          fullText: "Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.",
          language: "pt-BR",
          segments: [
            {
              startSeconds: 0,
              endSeconds: 5,
              text: "Mostro minha rotina de skincare pela manhã.",
              confidence: 0.92,
            },
            {
              startSeconds: 5,
              endSeconds: 9,
              text: "Falo sobre autocuidado.",
              confidence: 0.9,
            },
          ],
          provider: "manual",
        },
      };
    }

    if (taskType === "visual_summary") {
      return {
        visualSummary: "Pessoa apresenta uma rotina de autocuidado com produtos de skincare.",
      };
    }

    if (taskType === "frame_extraction") {
      return {
        frames: [
          {
            id: "mock-skincare-opening",
            timestampSeconds: 1,
            label: "opening",
            description: "Produtos de skincare organizados na bancada.",
            imageStorageKey: null,
          },
          {
            id: "mock-skincare-middle",
            timestampSeconds: 8,
            label: "middle",
            description: "Pessoa aplica produto no rosto durante a rotina.",
            imageStorageKey: null,
          },
          {
            id: "mock-skincare-closing",
            timestampSeconds: 18,
            label: "closing",
            description: "Fechamento com produtos de autocuidado em destaque.",
            imageStorageKey: null,
          },
        ],
      };
    }

    if (taskType === "ocr") {
      return {
        ocr: [
          { timestampSeconds: 2, text: "Rotina da manhã", confidence: 0.82 },
          { timestampSeconds: 7, text: "Autocuidado real", confidence: 0.8 },
        ],
      };
    }

    if (taskType === "technical_signals") {
      return {
        technicalSignals: [
          technicalSignal("duration", "45 segundos", 1),
          technicalSignal("text_overlay", "texto na tela sobre rotina e autocuidado", 0.82),
        ],
      };
    }
  }

  if (scenario === "backstage_process") {
    if (taskType === "transcription") {
      return {
        transcript: {
          fullText: "Mostro os bastidores de uma reunião e explico meu processo de criação.",
          language: "pt-BR",
          segments: [],
          provider: "manual",
        },
      };
    }

    if (taskType === "visual_summary") {
      return {
        visualSummary: "Pessoa em reunião mostrando bastidores de trabalho e processo de criação.",
      };
    }

    if (taskType === "frame_extraction") {
      return {
        frames: [
          {
            id: "mock-backstage-meeting",
            timestampSeconds: 2,
            label: "opening",
            description: "Pessoa em reunião com tela aberta.",
            imageStorageKey: null,
          },
          {
            id: "mock-backstage-screen",
            timestampSeconds: 9,
            label: "middle",
            description: "Tela mostra planejamento de conteúdo.",
            imageStorageKey: null,
          },
          {
            id: "mock-backstage-note",
            timestampSeconds: 16,
            label: "scene_change",
            description: "Anotação do processo de criação aparece na mesa.",
            imageStorageKey: null,
          },
        ],
      };
    }

    if (taskType === "ocr") {
      return {
        ocr: [
          { timestampSeconds: 6, text: "Planejamento", confidence: 0.78 },
          { timestampSeconds: 13, text: "Bastidores", confidence: 0.76 },
        ],
      };
    }

    if (taskType === "technical_signals") {
      return {
        technicalSignals: [
          technicalSignal("scene_change", "mudança de reunião para anotação de processo", 0.74),
          technicalSignal("audio_presence", "fala explicando processo de criação", 0.86),
        ],
      };
    }
  }

  if (scenario === "brand_ocr") {
    if (taskType === "visual_summary") {
      return {
        visualSummary: "Produtos de skincare aparecem em destaque durante a rotina.",
      };
    }

    if (taskType === "frame_extraction") {
      return {
        frames: [
          {
            id: "mock-brand-product",
            timestampSeconds: 1,
            label: "opening",
            description: "Produto de skincare aparece sobre a bancada.",
            imageStorageKey: null,
          },
          {
            id: "mock-brand-application",
            timestampSeconds: 8,
            label: "middle",
            description: "Pessoa aplica o produto no rosto.",
            imageStorageKey: null,
          },
          {
            id: "mock-brand-closing",
            timestampSeconds: 20,
            label: "closing",
            description: "Fechamento mostra o produto em contexto de rotina.",
            imageStorageKey: null,
          },
        ],
      };
    }

    if (taskType === "ocr") {
      return {
        ocr: [
          { timestampSeconds: 3, text: "Rotina da manhã", confidence: 0.83 },
          { timestampSeconds: 10, text: "Autocuidado real", confidence: 0.81 },
        ],
      };
    }

    if (taskType === "technical_signals") {
      return {
        technicalSignals: [
          technicalSignal("text_overlay", "texto na tela reforça rotina e autocuidado", 0.81),
          technicalSignal("duration", "45 segundos", 1),
        ],
      };
    }
  }

  if (scenario === "hook_improvement") {
    if (taskType === "transcription") {
      return {
        transcript: {
          fullText: "O vídeo começa devagar, depois mostra bastidores mais interessantes do processo.",
          language: "pt-BR",
          segments: [],
          provider: "manual",
        },
      };
    }

    if (taskType === "visual_summary") {
      return {
        visualSummary: "A abertura parece lenta antes de mostrar o ponto mais interessante.",
      };
    }

    if (taskType === "technical_signals") {
      return {
        technicalSignals: [
          technicalSignal("opening_density", "baixo nos primeiros segundos", 0.7),
          technicalSignal("scene_change", "melhora quando o bastidor aparece", 0.72),
        ],
      };
    }
  }

  return {};
}

export function runVideoProcessingMockProvider(params: {
  request: VideoProcessingTaskRequest;
  options?: VideoProcessingMockProviderOptions;
}): VideoProcessingTaskResult {
  const validation = validateVideoProcessingTaskRequest({
    request: params.request,
    capabilities: buildMockVideoProcessingProviderCapabilities(),
  });

  if (!validation.ok) {
    return failedResult({
      request: params.request,
      message: buildIssueMessage(params.request),
      options: params.options,
    });
  }

  const scenario = params.options?.scenario || "empty";

  if (scenario === "failure" || params.options?.failTasks?.includes(params.request.taskType)) {
    return failedResult({
      request: params.request,
      message: FAILED_MESSAGE,
      options: params.options,
    });
  }

  return markVideoProcessingTaskCompleted({
    result: createEmptyVideoProcessingTaskResult({ request: params.request }),
    artifacts: artifactsForTask(params.request.taskType, scenario),
    completedAt: completedAtFor(params.request, params.options),
    message: COMPLETED_MESSAGE,
  });
}

export function runVideoProcessingMockProviderBatch(params: {
  requests: VideoProcessingTaskRequest[];
  options?: VideoProcessingMockProviderOptions;
}): VideoProcessingTaskResult[] {
  return params.requests.map((request) =>
    runVideoProcessingMockProvider({
      request,
      options: params.options,
    }),
  );
}
