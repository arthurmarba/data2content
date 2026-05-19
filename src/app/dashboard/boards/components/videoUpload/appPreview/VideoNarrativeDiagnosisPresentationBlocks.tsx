import type {
  VideoNarrativeDiagnosisPresentation,
  VideoNarrativeDiagnosisPresentationBadge,
  VideoNarrativeDiagnosisPresentationCard,
  VideoNarrativeDiagnosisPresentationCTA,
  VideoNarrativeDiagnosisPresentationSection,
  VideoNarrativeDiagnosisPresentationTone,
} from "../../../videoUpload/videoNarrativeDiagnosisPresentationModel";

type VideoNarrativeDiagnosisPresentationBlocksProps = {
  presentation: VideoNarrativeDiagnosisPresentation;
};

const TONE_STYLES: Record<VideoNarrativeDiagnosisPresentationTone, string> = {
  insight: "border-zinc-200 bg-white",
  action: "border-zinc-300 bg-zinc-50",
  opportunity: "border-emerald-200 bg-emerald-50/60",
  unlock: "border-amber-200 bg-amber-50/70",
  warning: "border-rose-200 bg-rose-50/70",
};

const BADGE_STYLES: Record<VideoNarrativeDiagnosisPresentationBadge["tone"], string> = {
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  premium: "border-zinc-300 bg-zinc-950 text-white",
  instagram: "border-sky-200 bg-sky-50 text-sky-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

function Badge({ badge }: { badge: VideoNarrativeDiagnosisPresentationBadge }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${BADGE_STYLES[badge.tone]}`}>
      {badge.label}
    </span>
  );
}

function PresentationCard({ card }: { card: VideoNarrativeDiagnosisPresentationCard }) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${TONE_STYLES[card.tone]} ${
        card.priority === "high" ? "ring-1 ring-zinc-200" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-950">{card.title}</h3>
        {card.locked ? (
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600">
            Bloqueado
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{card.body}</p>
    </article>
  );
}

function CTAButton({ cta, secondary = false }: { cta: VideoNarrativeDiagnosisPresentationCTA; secondary?: boolean }) {
  return (
    <button
      type="button"
      className={
        secondary
          ? "rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-semibold text-zinc-800 shadow-sm"
          : "rounded-xl bg-zinc-950 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm"
      }
    >
      <span>{cta.label}</span>
      {cta.helper ? (
        <span className={secondary ? "mt-1 block text-xs font-medium leading-5 text-zinc-500" : "mt-1 block text-xs font-medium leading-5 text-zinc-300"}>
          {cta.helper}
        </span>
      ) : null}
    </button>
  );
}

function SectionBlock({ section }: { section: VideoNarrativeDiagnosisPresentationSection }) {
  const open = section.id === "video_diagnosis" || section.id === "creator_evolution";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">{section.title}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{section.description}</p>
        </div>
        {!open && section.collapsedByDefault ? (
          <span className="rounded-full bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-500">Compacto</span>
        ) : null}
      </div>
      <div className={open ? "mt-4 grid gap-3 md:grid-cols-2" : "mt-4 grid gap-3"}>
        {section.cards.map((card) => (
          <PresentationCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export function VideoNarrativeDiagnosisPresentationBlocks({
  presentation,
}: VideoNarrativeDiagnosisPresentationBlocksProps) {
  return (
    <section className="grid gap-4" aria-label="Diagnóstico estratégico do vídeo">
      <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Badge badge={presentation.hero.badge} />
          {presentation.badges.map((badge) => (
            <Badge key={badge.id} badge={badge} />
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              {presentation.hero.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700 sm:text-base">{presentation.hero.subtitle}</p>
          </div>
          <dl className="grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm">
            <div>
              <dt className="font-semibold text-zinc-500">Nível atual</dt>
              <dd className="mt-1 text-zinc-950">{presentation.hero.levelLabel}</dd>
            </div>
            {presentation.hero.nextLevelLabel ? (
              <div>
                <dt className="font-semibold text-zinc-500">Próximo nível</dt>
                <dd className="mt-1 text-zinc-950">{presentation.hero.nextLevelLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-semibold text-zinc-500">Precisão</dt>
              <dd className="mt-1 text-zinc-950">{presentation.hero.precisionLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zinc-500">Tempo de leitura</dt>
              <dd className="mt-1 text-zinc-950">{presentation.readingTimeHint}</dd>
            </div>
          </dl>
        </div>
      </article>

      <div className="grid gap-3 md:grid-cols-2">
        {presentation.priorityCards.map((card) => (
          <PresentationCard key={card.id} card={card} />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <CTAButton cta={presentation.primaryCTA} />
        {presentation.secondaryCTA ? <CTAButton cta={presentation.secondaryCTA} secondary /> : null}
      </div>

      <div className="grid gap-4">
        {presentation.sections
          .filter((section) => section.visible)
          .map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}
      </div>

      {presentation.lockedPreviews.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Próximas camadas do diagnóstico</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Sua primeira leitura já ajuda; o diagnóstico fica mais estratégico com mais contexto.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {presentation.lockedPreviews.map((preview, index) => (
              <article key={`${preview.id}-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-zinc-950">{preview.title}</h4>
                <p className="mt-2 text-sm leading-6 text-zinc-700">{preview.description}</p>
                <p className="mt-2 text-xs font-medium leading-5 text-zinc-500">{preview.reason}</p>
                <span className="mt-3 inline-flex rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white">
                  {preview.ctaLabel}
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
