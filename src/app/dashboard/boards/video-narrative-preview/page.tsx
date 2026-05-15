import {
  buildVideoNarrativePreviewScenario,
  VIDEO_NARRATIVE_PREVIEW_SCENARIOS,
} from "../components/videoUpload/buildVideoNarrativePreviewScenario";
import {
  canAccessInternalPreview,
  getCurrentInternalPreviewUser,
  type InternalPreviewUser,
} from "../internalPreviewAccess";
import { isVideoNarrativePreviewEnabled } from "../videoUpload/videoNarrativePreviewFeatureFlag";

type VideoNarrativePreviewPageProps = {
  searchParams?: { scenario?: string | string[] };
  viewer?: InternalPreviewUser | null;
};

function CompactBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-zinc-900">{value}</dd>
    </div>
  );
}

function TextList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-zinc-700">Sem sinais para este cenário.</p>;

  return (
    <ul className="mt-3 space-y-1 text-sm leading-6 text-zinc-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function BlockedInternalPreview({ reason }: { reason: "flag" | "permission" }) {
  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna bloqueada</p>
        <h1 className="mt-2 text-2xl font-semibold">Narrativa de Vídeo</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          {reason === "flag"
            ? "Preview interno bloqueado. Ative a flag correspondente para visualizar esta rota."
            : "Preview interno restrito a usuários admin/dev."}
        </p>
      </section>
    </main>
  );
}

export default async function VideoNarrativePreviewPage({
  searchParams,
  viewer,
}: VideoNarrativePreviewPageProps = {}) {
  if (!isVideoNarrativePreviewEnabled()) {
    return <BlockedInternalPreview reason="flag" />;
  }

  const currentUser = viewer === undefined ? await getCurrentInternalPreviewUser() : viewer;
  if (!canAccessInternalPreview(currentUser)) {
    return <BlockedInternalPreview reason="permission" />;
  }

  const preview = buildVideoNarrativePreviewScenario(searchParams?.scenario);
  const { scenario, analysis, seed } = preview;

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna</p>
          <h1 className="mt-2 text-2xl font-semibold">Preview interno — Narrativa de Vídeo</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Esta tela usa cenários controlados com análise narrativa mockada. Não há upload real, Gemini,
            processamento real, rede ou conexão com o fluxo do produto.
          </p>
        </header>

        <section className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {VIDEO_NARRATIVE_PREVIEW_SCENARIOS.map((candidate) => (
              <a
                key={candidate.id}
                href={`/dashboard/boards/video-narrative-preview?scenario=${candidate.id}`}
                className={
                  candidate.id === scenario.id
                    ? "rounded-full bg-zinc-950 px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-zinc-700"
                }
              >
                {candidate.label}
              </a>
            ))}
          </div>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4">
            <CompactBlock label="Cenário ativo" value={scenario.label} />
            <CompactBlock label="Pergunta do criador" value={scenario.creatorQuestion} />
            <CompactBlock label="Confiança" value={analysis.confidence} />
            <CompactBlock label="Ação primária" value={preview.primaryAction} />
          </dl>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">VideoNarrativeAnalysis</p>
            <h2 className="mt-1 text-lg font-semibold">Leitura narrativa</h2>
            <dl className="mt-4 grid gap-3">
              <CompactBlock label="Resumo" value={analysis.summary} />
              <CompactBlock label="Hook" value={analysis.hook.detected} />
              <CompactBlock label="Força do hook" value={analysis.hook.strength} />
              <CompactBlock label="Classificação D2C" value={`${analysis.d2cClassification.proposal} · ${analysis.d2cClassification.narrative || "sem narrativa"}`} />
              <CompactBlock label="Próximo passo sugerido" value={preview.suggestedNextStep} />
            </dl>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">Diagnóstico</p>
            <h2 className="mt-1 text-lg font-semibold">Sinais da análise</h2>
            <TextList
              items={[
                ...analysis.diagnosis.strengths,
                ...analysis.diagnosis.weaknesses,
                ...analysis.diagnosis.recommendedAdjustments,
              ]}
            />
          </div>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Tópicos falados</h2>
            <TextList items={analysis.spokenTopics} />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Elementos visuais</h2>
            <TextList items={analysis.visualElements} />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Cenas</h2>
            <TextList items={analysis.sceneStructure.map((scene) => `${scene.role}: ${scene.description}`)} />
          </div>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Blueprint</h2>
            <dl className="mt-4 grid gap-3">
              <CompactBlock label="O que postar" value={analysis.blueprintSuggestion.whatToPost} />
              <CompactBlock label="Por que seguir" value={analysis.blueprintSuggestion.whyThisPath} />
              <CompactBlock label="Como funcionar" value={analysis.blueprintSuggestion.howItShouldWork} />
            </dl>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Brand match</h2>
            <TextList
              items={[
                ...(analysis.brandMatch.enabled ? analysis.brandMatch.territories : []),
                ...(analysis.brandMatch.whyBrandsWouldFit ? [analysis.brandMatch.whyBrandsWouldFit] : []),
              ]}
            />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Evidências</h2>
            <TextList
              items={[
                ...(analysis.evidence.transcript ? [analysis.evidence.transcript] : []),
                ...analysis.evidence.ocr,
                ...analysis.evidence.frames,
                ...analysis.evidence.technicalSignals,
              ]}
            />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">PostCreationVideoSeed</p>
          <h2 className="mt-1 text-lg font-semibold">Entrada futura do board</h2>
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            <CompactBlock label="Ideia inicial" value={seed.initialIdea} />
            <CompactBlock label="Narrativa detectada" value={seed.detectedNarrative} />
            <CompactBlock label="Proposta sugerida" value={seed.suggestedProposal} />
            <CompactBlock label="Diagnóstico estratégico" value={seed.strategicDiagnosis} />
            <CompactBlock label="Direção de abertura" value={seed.scriptDirection.opening} />
            <CompactBlock label="Resumo de evidências" value={seed.evidenceSummary} />
          </dl>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg bg-zinc-50 p-3">
              <h3 className="text-sm font-semibold">Hints de marca</h3>
              <TextList items={seed.brandMatchHints} />
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <h3 className="text-sm font-semibold">Perguntas de refinamento</h3>
              <TextList items={seed.followUpQuestions.map((item) => `${item.question} ${item.reason}`)} />
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-zinc-950 p-4 text-white">
            <p className="text-xs font-semibold uppercase text-zinc-300">Ação primária</p>
            <p className="mt-1 text-sm leading-6">{preview.primaryAction}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
