import type { VideoNarrativeDiagnosisLockedSection } from "../../../videoUpload/videoNarrativeDiagnosisLearningModel";

type VideoNarrativePromptCardsProps = {
  lockedSections?: VideoNarrativeDiagnosisLockedSection[];
  showUpgrade?: boolean;
  showInstagram?: boolean;
};

function PromptCard({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{description}</p>
      <span className="mt-4 inline-flex rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">{cta}</span>
    </article>
  );
}

export function VideoNarrativePromptCards({
  lockedSections = [],
  showUpgrade = false,
  showInstagram = false,
}: VideoNarrativePromptCardsProps) {
  if (!showUpgrade && !showInstagram && lockedSections.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {showUpgrade ? (
        <PromptCard
          title="Quer liberar diagnósticos completos?"
          description="Assinantes podem fazer novas análises e acessar ações mais profundas."
          cta="Ver planos"
        />
      ) : null}
      {showInstagram ? (
        <PromptCard
          title="Quer deixar o diagnóstico mais preciso?"
          description="Conecte seu Instagram para comparar esse vídeo com o que já funciona no seu perfil."
          cta="Conectar Instagram"
        />
      ) : null}
      {lockedSections.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:col-span-2">
          <h3 className="text-base font-semibold text-zinc-950">Seções bloqueadas</h3>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-zinc-700">
            {lockedSections.map((section) => (
              <li key={section.key} className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-semibold text-zinc-900">{section.title}:</span> {section.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
