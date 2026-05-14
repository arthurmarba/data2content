import type {
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationStrategicPlan,
} from "../../postCreationAdaptiveTypes";
import type { NarrativeSourceAdaptiveInput } from "../../narrativeSource/narrativeSourceAdaptiveAdapter";
import type {
  CreatorNarrativeSignal,
  NarrativeAsset,
  NarrativeSource,
  NarrativeSourceIntentDetection,
} from "../../narrativeSource/narrativeSourceTypes";
import { CreatorSignalsPreview } from "./CreatorSignalsPreview";
import { NarrativeAdaptiveBridgePreview } from "./NarrativeAdaptiveBridgePreview";
import { NarrativeAssetsPreview } from "./NarrativeAssetsPreview";
import { NarrativeSourceIntentPreview } from "./NarrativeSourceIntentPreview";
import { NarrativeSourcePlanPreview } from "./NarrativeSourcePlanPreview";

export type NarrativeSourceExtractionPreview = {
  assets: NarrativeAsset[];
  profileSignals: CreatorNarrativeSignal[];
  summary: string;
  suggestedNextStep: string;
};

export type NarrativeSourcePreviewProps = {
  source: NarrativeSource;
  sourceIntent: NarrativeSourceIntentDetection;
  extraction: NarrativeSourceExtractionPreview;
  adaptiveInput: NarrativeSourceAdaptiveInput;
  adaptiveDetection?: PostCreationAdaptiveIntentDetection | null;
  questions?: PostCreationAdaptiveQuestion[];
  answerKey?: { summary: string } | null;
  plan?: PostCreationStrategicPlan | null;
};

function sanitizePreviewText(value: string): string {
  return value
    .replace(/\bgarantido\b/gi, "prometido")
    .replace(/\bcerteza\b/gi, "clareza")
    .replace(/\bcomprovado\b/gi, "observado")
    .replace(/\bviralizar\b/gi, "ampliar alcance")
    .replace(/\bscore\b/gi, "leitura")
    .replace(/\bnota\b/gi, "leitura")
    .replace(/\bpontuação\b/gi, "leitura")
    .replace(/\bacerto\b/gi, "sinal")
    .replace(/\berro\b/gi, "ajuste")
    .replace(/\bgabarito\b/gi, "referência")
    .replace(/\bresposta correta\b/gi, "referência");
}

function compactPreviewText(value?: string | null, maxLength = 160): string | null {
  const compacted = sanitizePreviewText(value || "").replace(/\s+/g, " ").trim();
  if (!compacted) return null;
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3).trim()}...` : compacted;
}

function SourceDetail({ label, value }: { label: string; value?: string | null }) {
  const displayValue = compactPreviewText(value);
  if (!displayValue) return null;

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-zinc-800">{displayValue}</dd>
    </div>
  );
}

function NarrativeSourceContent({ source }: { source: NarrativeSource }) {
  const metadataItems = [
    source.metadata.title ? `Título: ${source.metadata.title}` : null,
    source.metadata.platform ? `Plataforma: ${source.metadata.platform}` : null,
    source.metadata.format ? `Formato: ${source.metadata.format}` : null,
    source.metadata.campaignContext ? `Contexto: ${source.metadata.campaignContext}` : null,
    typeof source.metadata.durationSeconds === "number" ? `Duração: ${source.metadata.durationSeconds}s` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">Fonte narrativa</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Material analisado</h2>
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <SourceDetail label="Tipo" value={source.sourceType} />
        <SourceDetail label="Pergunta do criador" value={source.creatorQuestion} />
        <SourceDetail label="Texto bruto" value={source.rawText} />
        <SourceDetail label="Transcrição" value={source.transcript} />
        <SourceDetail label="Descrição visual" value={source.visualDescription} />
      </dl>

      {metadataItems.length ? (
        <div className="mt-4 rounded-lg bg-zinc-50 p-3">
          <h3 className="text-sm font-semibold text-zinc-950">Metadados</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-zinc-700">
            {metadataItems.map((item) => (
              <li key={item}>{sanitizePreviewText(item)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function NarrativeSourcePreview({
  source,
  sourceIntent,
  extraction,
  adaptiveInput,
  adaptiveDetection = null,
  questions = [],
  answerKey = null,
  plan = null,
}: NarrativeSourcePreviewProps) {
  return (
    <div className="space-y-4 rounded-lg bg-zinc-100 p-4 text-zinc-950">
      <NarrativeSourceContent source={source} />
      <NarrativeSourceIntentPreview sourceIntent={sourceIntent} />
      <NarrativeAssetsPreview
        assets={extraction.assets}
        summary={extraction.summary}
        suggestedNextStep={extraction.suggestedNextStep}
      />
      <CreatorSignalsPreview profileSignals={extraction.profileSignals} />
      <NarrativeAdaptiveBridgePreview
        adaptiveInput={adaptiveInput}
        adaptiveDetection={adaptiveDetection}
        questions={questions}
        answerKey={answerKey}
      />
      <NarrativeSourcePlanPreview plan={plan} />
    </div>
  );
}
