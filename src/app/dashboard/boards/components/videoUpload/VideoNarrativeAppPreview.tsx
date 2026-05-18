import {
  VIDEO_NARRATIVE_APP_PREVIEW_ACCESS_LEVELS,
  VIDEO_NARRATIVE_APP_PREVIEW_SCENARIOS,
  VIDEO_NARRATIVE_APP_PREVIEW_STAGES,
  type buildVideoNarrativeAppPreviewScenario,
} from "./buildVideoNarrativeAppPreviewScenario";
import type { ReactNode } from "react";

type VideoNarrativeAppPreviewData = ReturnType<typeof buildVideoNarrativeAppPreviewScenario>;

type VideoNarrativeAppPreviewProps = {
  preview: VideoNarrativeAppPreviewData;
};

function chipHref(params: {
  scenario: string;
  stage: string;
  access: string;
  instagramConnected: boolean;
  patch: Partial<{
    scenario: string;
    stage: string;
    access: string;
    instagramConnected: boolean;
  }>;
}) {
  const search = new URLSearchParams({
    scenario: params.patch.scenario ?? params.scenario,
    stage: params.patch.stage ?? params.stage,
    access: params.patch.access ?? params.access,
    instagram: (params.patch.instagramConnected ?? params.instagramConnected) ? "connected" : "disconnected",
  });

  return `/dashboard/boards/video-narrative-app-preview?${search.toString()}`;
}

function Chip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={
        active
          ? "rounded-full bg-zinc-950 px-3 py-1.5 text-sm font-semibold text-white"
          : "rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-zinc-700"
      }
    >
      {label}
    </a>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TextList({ items, empty = "Sem sinais neste cenário." }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm leading-6 text-zinc-600">{empty}</p>;

  return (
    <ul className="space-y-2 text-sm leading-6 text-zinc-700">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-md bg-zinc-50 px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;

  return (
    <div className="rounded-md bg-zinc-50 p-3">
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-zinc-900">{value}</dd>
    </div>
  );
}

function StageCard({ preview }: VideoNarrativeAppPreviewProps) {
  const { flowState, quiz, diagnosis } = preview;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Passo {flowState.progress.currentStep} de {flowState.progress.totalSteps} · {flowState.progress.label}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">{flowState.copy.title}</h2>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-100 md:w-56">
          <div
            className="h-2 rounded-full bg-zinc-950"
            style={{ width: `${Math.round((flowState.progress.currentStep / flowState.progress.totalSteps) * 100)}%` }}
          />
        </div>
      </div>

      {flowState.copy.subtitle ? <p className="mt-3 text-sm leading-6 text-zinc-700">{flowState.copy.subtitle}</p> : null}
      {flowState.copy.helper ? <p className="mt-2 text-sm leading-6 text-zinc-500">{flowState.copy.helper}</p> : null}

      {flowState.copy.loadingMessages.length > 0 ? (
        <ul className="mt-5 grid gap-2 md:grid-cols-2">
          {flowState.copy.loadingMessages.map((message) => (
            <li key={message} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      {flowState.stage === "adaptive_quiz" ? (
        <div className="mt-5 grid gap-3">
          {quiz.questions.map((question) => (
            <article key={question.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-950">{question.title}</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-600">{question.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {question.options.map((option) => (
                  <span key={option.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
                    {option.label}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {flowState.stage === "upgrade_prompt" ? (
        <div className="mt-5 rounded-lg bg-zinc-50 p-4">
          <h3 className="text-sm font-semibold text-zinc-950">Seções liberadas em planos superiores</h3>
          <TextList items={diagnosis.lockedSections.map((section) => `${section.title}: ${section.message}`)} />
        </div>
      ) : null}

      {flowState.stage === "instagram_optimization_prompt" ? (
        <div className="mt-5 rounded-lg bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
          Conectar Instagram permitirá comparar narrativas, formatos e territórios com o histórico do perfil quando essa
          integração existir no produto.
        </div>
      ) : null}

      {flowState.copy.ctas.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {flowState.copy.ctas.map((cta) => (
            <span
              key={cta.id}
              className={
                cta.primary
                  ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700"
              }
            >
              {cta.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DiagnosisPreview({ preview }: VideoNarrativeAppPreviewProps) {
  const { diagnosis, creatorProfile } = preview;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Diagnóstico">
        <dl className="grid gap-3">
          <Field label="Narrativa principal" value={diagnosis.mainNarrative} />
          <Field label="O que o vídeo comunica" value={diagnosis.whatVideoCommunicates} />
          <Field label="Intenção do criador" value={diagnosis.creatorIntent} />
          <Field label="Leitura estratégica" value={diagnosis.strategicReading} />
          <Field label="Ponto forte" value={diagnosis.strength} />
          <Field label="Ponto de atenção" value={diagnosis.weakness} />
          <Field label="Ajuste recomendado" value={diagnosis.recommendedAdjustment} />
          <Field label="Gancho sugerido" value={diagnosis.suggestedHook} />
        </dl>
      </Section>

      <Section title="Potencial de marcas">
        <TextList items={diagnosis.brandPotential.territories} />
        {diagnosis.brandPotential.whyItFits ? (
          <p className="mt-3 text-sm leading-6 text-zinc-700">{diagnosis.brandPotential.whyItFits}</p>
        ) : null}
      </Section>

      <Section title="Blueprint">
        <dl className="grid gap-3">
          <Field label="O que postar" value={diagnosis.blueprint.whatToPost} />
          <Field label="Por que seguir" value={diagnosis.blueprint.whyThisPath} />
          <Field label="Como funcionar" value={diagnosis.blueprint.howItShouldWork} />
        </dl>
        <div className="mt-3">
          <TextList items={diagnosis.blueprint.scenes} />
        </div>
      </Section>

      <Section title="Direção de roteiro">
        {diagnosis.scriptDirection.locked ? (
          <p className="text-sm leading-6 text-zinc-600">Direção completa bloqueada neste nível de acesso.</p>
        ) : (
          <dl className="grid gap-3">
            <Field label="Abertura" value={diagnosis.scriptDirection.opening} />
            <Field label="Fechamento" value={diagnosis.scriptDirection.closing} />
            <Field label="Tom" value={diagnosis.scriptDirection.tone} />
            <div>
              <dt className="mb-2 text-xs font-semibold uppercase text-zinc-500">Desenvolvimento</dt>
              <TextList items={diagnosis.scriptDirection.development} />
            </div>
          </dl>
        )}
      </Section>

      <Section title="Seções bloqueadas">
        <TextList items={diagnosis.lockedSections.map((section) => `${section.title}: ${section.message}`)} />
      </Section>

      <Section title="Próximas ações">
        <TextList items={diagnosis.nextActions.map((action) => `${action.label}: ${action.description ?? "Ação disponível."}`)} />
      </Section>

      <Section title="Sinais do criador">
        <TextList items={diagnosis.creatorSignals.map((signal) => `${signal.type}: ${signal.value}`)} />
      </Section>

      <Section title="Resumo do perfil narrativo">
        <dl className="grid gap-3">
          <Field label="Objetivos" value={creatorProfile.summary.strongestContentGoals.join(", ") || null} />
          <Field label="Formatos" value={creatorProfile.summary.preferredFormats.join(", ") || null} />
          <Field label="Ganchos" value={creatorProfile.summary.preferredHookDirections.join(", ") || null} />
          <Field label="Territórios" value={creatorProfile.summary.preferredBrandTerritories.join(", ") || null} />
          <Field label="Comercial" value={creatorProfile.summary.commercialPreferences.join(", ") || null} />
          <Field label="Posicionamento" value={creatorProfile.summary.positioningSignals.join(", ") || null} />
        </dl>
      </Section>

      <Section title="Comparação com Instagram">
        <dl className="grid gap-3">
          <Field label="Resumo" value={diagnosis.instagramComparison.summary} />
          <Field label="Narrativas próximas" value={diagnosis.instagramComparison.matchingNarratives.join(", ") || null} />
          <Field label="Formatos próximos" value={diagnosis.instagramComparison.matchingFormats.join(", ") || null} />
        </dl>
        {diagnosis.instagramComparison.locked ? (
          <p className="mt-3 text-sm leading-6 text-zinc-600">Comparação depende de conexão Instagram futura.</p>
        ) : null}
      </Section>
    </div>
  );
}

export function VideoNarrativeAppPreview({ preview }: VideoNarrativeAppPreviewProps) {
  const active = {
    scenario: preview.scenario.id,
    stage: preview.flowState.stage,
    access: preview.accessLevel,
    instagramConnected: preview.instagramConnected,
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-5">
        <header className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno — Análise Guiada de Vídeo</p>
          <h1 className="mt-2 text-2xl font-semibold">Experiência app-first com mock narrativo</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Cenários mockados. Sem upload real, Gemini, storage, banco ou fluxo real.
          </p>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-zinc-950">Cenário</h2>
              <div className="flex flex-wrap gap-2">
                {VIDEO_NARRATIVE_APP_PREVIEW_SCENARIOS.map((scenario) => (
                  <Chip
                    key={scenario.id}
                    label={scenario.label}
                    active={scenario.id === active.scenario}
                    href={chipHref({ ...active, patch: { scenario: scenario.id } })}
                  />
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-zinc-950">Etapa</h2>
              <div className="flex flex-wrap gap-2">
                {VIDEO_NARRATIVE_APP_PREVIEW_STAGES.map((stage) => (
                  <Chip
                    key={stage}
                    label={stage}
                    active={stage === active.stage}
                    href={chipHref({ ...active, patch: { stage } })}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h2 className="mb-2 text-sm font-semibold text-zinc-950">Acesso</h2>
                <div className="flex flex-wrap gap-2">
                  {VIDEO_NARRATIVE_APP_PREVIEW_ACCESS_LEVELS.map((access) => (
                    <Chip
                      key={access}
                      label={access}
                      active={access === active.access}
                      href={chipHref({ ...active, patch: { access } })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-zinc-950">Instagram</h2>
                <div className="flex flex-wrap gap-2">
                  <Chip
                    label="connected"
                    active={active.instagramConnected}
                    href={chipHref({ ...active, patch: { instagramConnected: true } })}
                  />
                  <Chip
                    label="disconnected"
                    active={!active.instagramConnected}
                    href={chipHref({ ...active, patch: { instagramConnected: false } })}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <StageCard preview={preview} />

        {preview.flowState.stage === "diagnosis_ready" ? <DiagnosisPreview preview={preview} /> : null}
      </div>
    </main>
  );
}
