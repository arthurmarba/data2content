import type {
  PostCreationAdaptiveAnswerEvaluation,
} from "../postCreationAdaptiveAnswerKey";
import type {
  PostCreationAdaptiveMode,
  PostCreationStrategicPlan,
} from "../postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "../postCreationFunnel";

type SummaryInputRecord = Record<string, unknown>;

export type PostCreationAdaptiveFinalIntentSummary = {
  eyebrow: string;
  title: string;
  answer: string;
  supportingText: string;
  chips: string[];
};

export type ResolveAdaptiveFinalIntentSummaryParams = {
  mode?: PostCreationAdaptiveMode | null;
  originalPrompt?: string | null;
  decision?: Partial<PostCreationDecisionState> | null;
  idea?: Partial<PostCreationIdeaVariant> | null;
  blueprint?: Partial<PostCreationBlueprint> | null;
  idealPlan?: PostCreationStrategicPlan | null;
  evaluations?: PostCreationAdaptiveAnswerEvaluation[];
};

export type PostCreationAdaptiveFinalIntentSummaryCardProps =
  ResolveAdaptiveFinalIntentSummaryParams;

const PROHIBITED_COPY = [
  /\bgarantid[ao]s?\b/gi,
  /\bcerteza\b/gi,
  /\bprovad[ao]s?\b/gi,
  /\bcomprov\w*\b/gi,
];

function cleanText(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) return null;

  return PROHIBITED_COPY.reduce((text, pattern) => text.replace(pattern, "sustentado"), normalized);
}

function cleanShortText(value: string | null | undefined, maxLength = 118): string | null {
  const text = cleanText(value);
  if (!text) return null;
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  return sliced || text.slice(0, maxLength).trim();
}

function readRecordString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as SummaryInputRecord;

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string") {
      const text = cleanShortText(candidate);
      if (text) return text;
    }
  }

  return null;
}

function findEvaluationAnswer(
  evaluations: PostCreationAdaptiveAnswerEvaluation[] | undefined,
  questionPattern: RegExp,
  mapKey?: string | null,
): string | null {
  const list = evaluations ?? [];
  const evaluation = list.find((item) =>
    (mapKey && item.mapKey === mapKey) || questionPattern.test(item.questionId),
  );

  if (!evaluation) return null;

  const correct = cleanShortText(evaluation.correctOptionLabel);
  if (correct) return correct;

  if (!evaluation.isCorrect) return null;

  const selected = cleanShortText(evaluation.selectedOptionLabel);
  if (selected) return selected;

  return readRecordString(evaluation, [
    "answerLabel",
    "optionLabel",
    "label",
    "value",
  ]);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const text = cleanShortText(value);
    if (text) return text;
  }
  return null;
}

function hasMinimumData(params: ResolveAdaptiveFinalIntentSummaryParams): boolean {
  return Boolean(
    params.mode ||
      cleanText(params.originalPrompt) ||
      cleanText(params.idealPlan?.pauta) ||
      cleanText(params.idealPlan?.format) ||
      cleanText(params.idea?.title) ||
      cleanText(params.blueprint?.whatToPost) ||
      (params.evaluations?.length ?? 0) > 0,
  );
}

function resolveFormatAnswer(params: ResolveAdaptiveFinalIntentSummaryParams): string {
  return firstNonEmpty(
    findEvaluationAnswer(params.evaluations, /format/i, "format"),
    params.idealPlan?.format,
    readRecordString(params.blueprint, ["formatLabel", "format"]),
    readRecordString(params.decision, ["formatLabel", "format"]),
    readRecordString(params.idea, ["formatLabel", "format"]),
    params.blueprint?.whatToPost,
    params.idea?.title,
    params.idealPlan?.pauta,
  ) || "Formato definido a partir do jogo estratégico.";
}

function resolveBrandAnswer(params: ResolveAdaptiveFinalIntentSummaryParams): string {
  return firstNonEmpty(
    findEvaluationAnswer(params.evaluations, /brand/i, "brand"),
    params.idealPlan?.brandMatch?.category
      ? `Marca em ${params.idealPlan.brandMatch.category}`
      : null,
    params.idealPlan?.brandMatch?.angle,
    params.blueprint?.whyThisPath,
    params.idea?.title,
  ) || "Marca entra como parte natural da narrativa.";
}

function resolveCollabAnswer(params: ResolveAdaptiveFinalIntentSummaryParams): string {
  return firstNonEmpty(
    findEvaluationAnswer(params.evaluations, /collab|who/i, "collab"),
    findEvaluationAnswer(params.evaluations, /collab|who/i, "who"),
    params.idealPlan?.collabMatch?.creatorProfile,
    params.idealPlan?.collabMatch?.collaborationAngle,
    params.idea?.title,
  ) || "Creator/caminho de collab com melhor função estratégica para essa pauta.";
}

function resolvePautaAnswer(params: ResolveAdaptiveFinalIntentSummaryParams): string {
  return firstNonEmpty(
    params.idea?.title,
    params.blueprint?.whatToPost,
    params.idealPlan?.pauta,
  ) || "Pauta definida a partir do jogo estratégico.";
}

export function resolveAdaptiveFinalIntentSummary(
  params: ResolveAdaptiveFinalIntentSummaryParams,
): PostCreationAdaptiveFinalIntentSummary | null {
  if (!hasMinimumData(params)) return null;

  if (params.mode === "format_guidance") {
    return {
      eyebrow: "Resposta da sua pergunta",
      title: "Formato recomendado",
      answer: resolveFormatAnswer(params),
      supportingText:
        "Essa recomendação cruza o formato mais forte com tema, narrativa e contexto que apareceram nos sinais do seu conteúdo.",
      chips: ["Formato", "Narrativa", "Tema", "Execução"],
    };
  }

  if (params.mode === "brand_match") {
    return {
      eyebrow: "Resposta da sua pergunta",
      title: "Encaixe de marca recomendado",
      answer: resolveBrandAnswer(params),
      supportingText: "Use esse caminho para defender o match entre a marca e o conteúdo orgânico.",
      chips: ["Marca", "Narrativa", "Uso real"],
    };
  }

  if (params.mode === "collab_match") {
    return {
      eyebrow: "Resposta da sua pergunta",
      title: "Collab recomendada",
      answer: resolveCollabAnswer(params),
      supportingText: "A collab deve adicionar contraste, repertório ou nova leitura para o mesmo tema.",
      chips: ["Creator", "Contraste", "Tema"],
    };
  }

  if (params.mode === "comment_to_post") {
    return {
      eyebrow: "Resposta da sua pergunta",
      title: "Resposta que vira conteúdo",
      answer: firstNonEmpty(
        findEvaluationAnswer(params.evaluations, /format/i, "format"),
        findEvaluationAnswer(params.evaluations, /why/i, "why"),
      ) || "Transforme o comentário em uma pauta com gancho, narrativa e CTA claros.",
      supportingText: "O comentário vira ponto de partida para uma pauta que continua a conversa da audiência.",
      chips: ["Comentário", "Gancho", "CTA"],
    };
  }

  if (params.mode === "weekly_plan") {
    return {
      eyebrow: "Resposta da sua pergunta",
      title: "Direção da semana",
      answer: firstNonEmpty(
        findEvaluationAnswer(params.evaluations, /schedule/i, "schedule"),
        findEvaluationAnswer(params.evaluations, /format/i, "format"),
      ) || "Plano orientado pela cadência e pelos sinais de conteúdo mais fortes.",
      supportingText: "A semana fica mais clara quando cada pauta tem função, formato e janela de publicação.",
      chips: ["Cadência", "Formato", "Ação"],
    };
  }

  return {
    eyebrow: "Resposta da sua pergunta",
    title: "Pauta recomendada",
    answer: resolvePautaAnswer(params),
    supportingText: "A recomendação organiza a pergunta inicial em uma direção prática para virar conteúdo.",
    chips: ["Pauta", "Narrativa", "Próximo passo"],
  };
}

export default function PostCreationAdaptiveFinalIntentSummaryCard(
  props: PostCreationAdaptiveFinalIntentSummaryCardProps,
) {
  const summary = resolveAdaptiveFinalIntentSummary(props);
  if (!summary) return null;

  return (
    <section
      aria-label="Resumo final da intenção adaptativa"
      className="w-full rounded-[28px] border border-zinc-200/80 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            {summary.eyebrow}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-zinc-950">
            {summary.title}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-600"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 break-words text-lg font-semibold leading-7 text-zinc-950">
        {summary.answer}
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        {summary.supportingText}
      </p>
    </section>
  );
}
