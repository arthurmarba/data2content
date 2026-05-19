import type { VideoNarrativeCreatorProfile } from "../../../videoUpload/videoNarrativeCreatorProfileContract";
import type { VideoNarrativeDiagnosisPresentation } from "../../../videoUpload/videoNarrativeDiagnosisPresentationModel";
import type { VideoNarrativeStrategicDiagnosis } from "../../../videoUpload/videoNarrativeDiagnosisLearningModel";
import { formatSignalLabel } from "./VideoNarrativeAppPreviewPrimitives";
import { VideoNarrativeDiagnosisPresentationBlocks } from "./VideoNarrativeDiagnosisPresentationBlocks";
import type { ReactNode } from "react";

type VideoNarrativeDiagnosisBlocksProps = {
  diagnosis: VideoNarrativeStrategicDiagnosis;
  creatorProfile?: VideoNarrativeCreatorProfile | null;
  presentation?: VideoNarrativeDiagnosisPresentation | null;
};

const FINAL_ACTIONS = [
  "Transformar em roteiro",
  "Criar blueprint",
  "Criar versão para publi",
  "Conectar Instagram",
  "Ver planos",
];

function Block({
  title,
  eyebrow,
  children,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={wide ? "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2" : "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"}>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{eyebrow}</p> : null}
      <h3 className="mt-1 text-lg font-semibold text-zinc-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value, large = false }: { label: string; value?: string | null; large?: boolean }) {
  if (!value) return null;

  return (
    <div className={large ? "rounded-2xl bg-zinc-50 p-4" : "rounded-xl bg-zinc-50 p-3"}>
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className={large ? "mt-2 text-base leading-7 text-zinc-950" : "mt-1 text-sm leading-6 text-zinc-900"}>
        {value}
      </dd>
    </div>
  );
}

function List({ items, empty = "Sem dados para este bloco." }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm leading-6 text-zinc-600">{empty}</p>;

  return (
    <ul className="space-y-2 text-sm leading-6 text-zinc-700">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-xl bg-zinc-50 px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ActionPills() {
  return (
    <div className="flex flex-wrap gap-2">
      {FINAL_ACTIONS.map((action) => (
        <span key={action} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-zinc-700">
          {action}
        </span>
      ))}
    </div>
  );
}

export function VideoNarrativeDiagnosisBlocks({
  diagnosis,
  creatorProfile,
  presentation,
}: VideoNarrativeDiagnosisBlocksProps) {
  if (presentation) {
    return <VideoNarrativeDiagnosisPresentationBlocks presentation={presentation} />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title="Narrativa principal" eyebrow="Hero do diagnóstico" wide>
        <dl className="grid gap-3 md:grid-cols-3">
          <Field label="Narrativa principal" value={diagnosis.mainNarrative} large />
          <Field label="O que o vídeo comunica" value={diagnosis.whatVideoCommunicates} large />
          <Field label="Intenção do criador" value={diagnosis.creatorIntent} large />
        </dl>
      </Block>

      <Block title="Leitura estratégica" wide>
        <dl className="grid gap-3 md:grid-cols-2">
          <Field label="Diagnóstico estratégico" value={diagnosis.strategicReading} large />
          <Field label="Ponto forte" value={diagnosis.strength} />
          <Field label="Ponto de atenção" value={diagnosis.weakness} />
          <Field label="Ajuste recomendado" value={diagnosis.recommendedAdjustment} />
        </dl>
      </Block>

      <Block title="Gancho">
        <dl className="grid gap-3">
          <Field label="Gancho sugerido" value={diagnosis.suggestedHook} large />
        </dl>
      </Block>

      <Block title="Potencial comercial">
        <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Marcas e territórios</p>
        <List items={diagnosis.brandPotential.territories} />
        {diagnosis.brandPotential.whyItFits ? (
          <p className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">{diagnosis.brandPotential.whyItFits}</p>
        ) : null}
      </Block>

      <Block title="Blueprint">
        <dl className="grid gap-3">
          <Field label="O que postar" value={diagnosis.blueprint.whatToPost} />
          <Field label="Por que esse caminho" value={diagnosis.blueprint.whyThisPath} />
          <Field label="Como funciona" value={diagnosis.blueprint.howItShouldWork} />
        </dl>
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Cenas</p>
          <List items={diagnosis.blueprint.scenes} />
        </div>
      </Block>

      <Block title="Próximas ações">
        <ActionPills />
        <div className="mt-4">
          <List items={diagnosis.nextActions.map((action) => `${action.label}: ${action.description ?? "Ação disponível."}`)} />
        </div>
      </Block>

      <Block title="Aprendizado sobre o criador" wide>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-zinc-950">Sinais do criador</h4>
            <div className="mt-3">
              <List items={diagnosis.creatorSignals.map((signal) => `${formatSignalLabel(signal.type)}: ${signal.value}`)} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-950">Resumo do perfil narrativo</h4>
            {creatorProfile ? (
              <dl className="mt-3 grid gap-3">
                <Field label="Objetivos" value={creatorProfile.summary.strongestContentGoals.join(", ") || null} />
                <Field label="Formatos" value={creatorProfile.summary.preferredFormats.join(", ") || null} />
                <Field label="Ganchos" value={creatorProfile.summary.preferredHookDirections.join(", ") || null} />
                <Field label="Territórios" value={creatorProfile.summary.preferredBrandTerritories.join(", ") || null} />
                <Field label="Comercial" value={creatorProfile.summary.commercialPreferences.join(", ") || null} />
                <Field label="Posicionamento" value={creatorProfile.summary.positioningSignals.join(", ") || null} />
              </dl>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-600">Sem perfil narrativo para este cenário.</p>
            )}
          </div>
        </div>
      </Block>

      <Block title="Seções bloqueadas">
        <List items={diagnosis.lockedSections.map((section) => `${section.title}: ${section.message}`)} />
      </Block>

      <Block title="Comparação com Instagram">
        <dl className="grid gap-3">
          <Field label="Resumo" value={diagnosis.instagramComparison.summary} />
          <Field label="Narrativas próximas" value={diagnosis.instagramComparison.matchingNarratives.join(", ") || null} />
          <Field label="Formatos próximos" value={diagnosis.instagramComparison.matchingFormats.join(", ") || null} />
        </dl>
        {diagnosis.instagramComparison.locked ? (
          <p className="mt-3 text-sm leading-6 text-zinc-600">Comparação depende de conexão Instagram futura.</p>
        ) : null}
      </Block>
    </div>
  );
}
