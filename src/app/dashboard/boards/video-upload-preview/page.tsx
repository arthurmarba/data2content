import { NarrativeSourcePreview } from "../components/narrativeSource";
import {
  buildVideoUploadPreviewScenario,
  VIDEO_UPLOAD_PREVIEW_SCENARIOS,
} from "../components/videoUpload/buildVideoUploadPreviewScenario";
import { isVideoUploadPreviewEnabled } from "../videoUpload/videoUploadPreviewFeatureFlag";

type VideoUploadPreviewPageProps = {
  searchParams?: {
    scenario?: string | string[];
  };
};

function formatBytes(value: number | null): string {
  if (typeof value !== "number") return "não informado";
  return `${Math.round((value / (1024 * 1024)) * 10) / 10} MB`;
}

function CompactBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-zinc-900">{value}</dd>
    </div>
  );
}

export default function VideoUploadPreviewPage({ searchParams }: VideoUploadPreviewPageProps = {}) {
  const isEnabled = isVideoUploadPreviewEnabled();

  if (!isEnabled) {
    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
        <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna bloqueada</p>
          <h1 className="mt-2 text-2xl font-semibold">Video Upload Foundation</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Esta tela permanece bloqueada enquanto a flag interna de preview de vídeo estiver desligada.
          </p>
        </section>
      </main>
    );
  }

  const preview = buildVideoUploadPreviewScenario(searchParams?.scenario);
  const { scenario, validation, readiness, narrativeSource, sourceIntent, adaptiveDetection } = preview;
  const draft = validation.normalizedDraft;
  const artifacts = scenario.artifacts;
  const statusLabel = validation.ok ? "validation ok" : "validation pendente";
  const readinessLabel = readiness ? "readiness true" : "readiness false";
  const hasArtifactDetails =
    Boolean(artifacts.transcript.fullText) ||
    Boolean(artifacts.visualSummary) ||
    artifacts.frames.length > 0 ||
    artifacts.ocr.length > 0;

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna</p>
          <h1 className="mt-2 text-2xl font-semibold">Preview interno — Video Upload Foundation</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Esta tela usa cenários controlados. Não há upload real, processamento real ou conexão com o fluxo do
            produto.
          </p>
        </header>

        <section className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {VIDEO_UPLOAD_PREVIEW_SCENARIOS.map((candidate) => {
              const isActive = candidate.id === scenario.id;

              return (
                <a
                  key={candidate.id}
                  href={`/dashboard/boards/video-upload-preview?scenario=${candidate.id}`}
                  className={
                    isActive
                      ? "rounded-full bg-zinc-950 px-3 py-1.5 text-sm font-semibold text-white"
                      : "rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-zinc-700"
                  }
                >
                  {candidate.label}
                </a>
              );
            })}
          </div>

          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-5">
            <CompactBlock label="Cenário ativo" value={scenario.label} />
            <CompactBlock label="Validação" value={statusLabel} />
            <CompactBlock label="Readiness" value={readinessLabel} />
            <CompactBlock label="Intent detectada" value={sourceIntent?.intent || "não avaliada"} />
            <CompactBlock label="Adaptive mode" value={adaptiveDetection?.mode || "não avaliado"} />
          </dl>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">Draft do vídeo</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-950">Dados simulados</h2>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <CompactBlock label="Arquivo" value={draft.fileName || "não informado"} />
              <CompactBlock label="MIME" value={draft.mimeType || "não informado"} />
              <CompactBlock label="Tamanho" value={formatBytes(draft.sizeBytes)} />
              <CompactBlock
                label="Duração"
                value={typeof draft.durationSeconds === "number" ? `${draft.durationSeconds}s` : "não informada"}
              />
              <CompactBlock label="Pergunta" value={draft.creatorQuestion || "não informada"} />
              <CompactBlock label="Source type" value={narrativeSource?.sourceType || "não gerado"} />
            </dl>
            {!validation.ok ? (
              <div className="mt-4 rounded-lg bg-zinc-50 p-3">
                <h3 className="text-sm font-semibold text-zinc-950">Pendências de validação</h3>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-zinc-700">
                  {validation.errors.map((item) => (
                    <li key={item.code}>{item.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">Artifacts simulados</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-950">Contexto de processamento</h2>
            {hasArtifactDetails ? (
              <dl className="mt-4 grid gap-3 text-sm">
                <CompactBlock label="Transcrição" value={artifacts.transcript.fullText} />
                <CompactBlock label="Resumo visual" value={artifacts.visualSummary} />
                <CompactBlock
                  label="Frames"
                  value={artifacts.frames.map((frame) => frame.description).filter(Boolean).join(" | ") || null}
                />
                <CompactBlock
                  label="Texto na tela"
                  value={artifacts.ocr.map((item) => item.text).filter(Boolean).join(" | ") || null}
                />
              </dl>
            ) : (
              <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                Sem artifacts simulados para este cenário.
              </p>
            )}
          </div>
        </section>

        {narrativeSource && preview.extraction && preview.adaptiveInput ? (
          <NarrativeSourcePreview
            source={narrativeSource}
            sourceIntent={preview.sourceIntent}
            extraction={preview.extraction}
            adaptiveInput={preview.adaptiveInput}
            adaptiveDetection={preview.adaptiveDetection}
            questions={preview.questions}
            answerKey={preview.answerKey}
            plan={preview.plan}
          />
        ) : (
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">Pipeline pausado</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-950">Draft não validado</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              A prévia não roda NSE ou Adaptive V2 quando o draft controlado não passa pela validação.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
