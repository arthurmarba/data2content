"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CreatorNarrativeMapReadingChapter, CreatorNarrativeMapReadingPresentation } from "../../../videoUpload/creatorNarrativeMapReadingChapters";
import type { NarrativeMapMobileReadingItem, NarrativeMapMobileViewModel } from "../../../videoUpload/narrativeMapMobileViewModel";
import type { VideoNarrativeSynthesisSnapshotWriteSummary } from "../../../videoUpload/videoNarrativeSafeResponseBuilder";
import { NarrativeMapReadingChapterCard } from "./NarrativeMapReadingChapterCard";
import { NarrativeMapReadingChapterModal } from "./NarrativeMapReadingChapterModal";
import { NarrativeMapReadingFullDiagnosisModal } from "./NarrativeMapReadingFullDiagnosisModal";
import { NarrativeMapSnapshotReviewPanel } from "./NarrativeMapSnapshotReviewPanel";
import {
  getNarrativeMapAccessAction,
  getNarrativeMapAccessStatusText,
  type NarrativeMapAccessState,
  type NarrativeMapReadingQuotaSnapshot,
} from "../../../videoUpload/narrativeMapAccessState";

type NarrativeMapReadingPreviewTab = "profile" | "readings" | "opportunities";

const TAB_LABELS: Record<NarrativeMapReadingPreviewTab, string> = {
  profile: "Mapa",
  readings: "Leituras",
  opportunities: "Oportunidades",
};

function ReadingDetailModal({
  reading,
  onClose,
}: {
  reading: NarrativeMapMobileReadingItem | null;
  onClose: () => void;
}) {
  if (!reading) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-zinc-950/45 p-3" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={reading.rememberedAs}
        className="max-h-[82%] w-full overflow-y-auto rounded-[1.35rem] bg-white p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-zinc-500">{reading.dateLabel}</p>
            <h3 className="mt-1 text-lg font-semibold leading-6 text-zinc-950">{reading.rememberedAs}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600"
          >
            Fechar
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase text-zinc-500">Contribuição</p>
            <p className="mt-1 text-sm font-semibold text-zinc-950">{reading.contributionLabel}</p>
          </div>
          <div className="rounded-2xl bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase text-zinc-500">Como pesa no Perfil</p>
            <p className="mt-1 text-sm leading-6 text-zinc-700">{reading.profileImpactPreview}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function NarrativeMapMobileShell({
  viewModel,
  presentation,
  statusText,
  stateNav,
  snapshotReview,
  internalReview,
  accessState,
  readingQuota,
  onPrimaryAccessAction,
}: {
  viewModel: NarrativeMapMobileViewModel;
  presentation: CreatorNarrativeMapReadingPresentation;
  statusText?: string | null;
  stateNav?: ReactNode;
  snapshotReview?: VideoNarrativeSynthesisSnapshotWriteSummary | null;
  internalReview?: boolean;
  accessState?: NarrativeMapAccessState;
  readingQuota?: Partial<NarrativeMapReadingQuotaSnapshot> | null;
  onPrimaryAccessAction?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<NarrativeMapReadingPreviewTab>(
    (viewModel.tabs.find((tab) => tab.active)?.id ?? "profile") as NarrativeMapReadingPreviewTab,
  );
  const [activeChapter, setActiveChapter] = useState<CreatorNarrativeMapReadingChapter | null>(null);
  const [activeReading, setActiveReading] = useState<NarrativeMapMobileReadingItem | null>(null);
  const [fullDiagnosisOpen, setFullDiagnosisOpen] = useState(false);
  const profileChapters = useMemo(() => viewModel.profile.chapters, [viewModel.profile.chapters]);
  const readingsCount = viewModel.profileHeader.metrics.find((metric) => metric.label === "Leituras")?.value ?? "0";
  const patternsCount = viewModel.profileHeader.metrics.find((metric) => metric.label === "Padrões")?.value ?? "0";
  const opportunitiesCount = viewModel.profileHeader.metrics.find((metric) => metric.label === "Oportunidades")?.value ?? "0";
  const accessAction = accessState ? getNarrativeMapAccessAction(accessState) : null;
  const accessStatusText = accessState
    ? getNarrativeMapAccessStatusText({ state: accessState, quota: readingQuota })
    : null;

  return (
    <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-zinc-200 bg-zinc-950 p-2 shadow-xl">
      <section className="relative min-h-[760px] overflow-hidden rounded-[1.5rem] bg-[#f7f7f4]">
        <div className="px-5 pt-4" aria-label="Topo compacto do creator">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-950">{viewModel.profileHeader.displayName}</h2>
              <p className="mt-0.5 text-xs font-medium text-zinc-500">
                {viewModel.profileHeader.displayHandle} · {statusText ?? viewModel.profileHeader.statusLabel}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm">
              D2C
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 rounded-[1.1rem] bg-white p-2.5 text-center shadow-sm">
            <div>
              <p className="text-base font-semibold text-zinc-950">{readingsCount}</p>
              <p className="text-[11px] font-medium text-zinc-500">Leituras</p>
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-950">{patternsCount}</p>
              <p className="text-[11px] font-medium text-zinc-500">Padrões</p>
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-950">{opportunitiesCount}</p>
              <p className="text-[11px] font-medium text-zinc-500">Oportunidades</p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-4">
          <section className="rounded-[1.5rem] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{viewModel.hero.badgeLabel}</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-normal text-zinc-950">{viewModel.hero.title}</h2>
            <p className="mt-2 text-base font-semibold leading-6 text-zinc-950">{viewModel.hero.headline}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{viewModel.hero.subheadline}</p>
            {accessAction && accessStatusText ? (
              <div className="mt-4 rounded-2xl bg-zinc-50 p-3">
                <p className="text-xs font-semibold text-zinc-500">{accessStatusText}</p>
                <button
                  type="button"
                  data-priority="primary"
                  className="mt-2 min-h-[40px] w-full rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-zinc-950/15"
                  onClick={onPrimaryAccessAction}
                >
                  {accessAction.label}
                </button>
              </div>
            ) : null}
            <div className="mt-4 grid gap-2">
              {viewModel.profile.secondaryAction ? (
                <button
                  type="button"
                  data-priority="secondary"
                  className="min-h-[38px] rounded-full border border-transparent bg-transparent px-4 py-2 text-sm font-semibold text-zinc-600 underline decoration-zinc-300 underline-offset-4"
                  onClick={() => setFullDiagnosisOpen(true)}
                >
                  {viewModel.profile.secondaryAction.label}
                </button>
              ) : null}
            </div>
          </section>
        </div>

        <div className="mx-5 mt-4 grid grid-cols-3 rounded-full bg-white p-1 shadow-sm" role="tablist" aria-label="Abas do mapa narrativo">
          {viewModel.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "rounded-full bg-zinc-950 px-3 py-2 text-xs font-semibold text-white"
                  : "rounded-full px-3 py-2 text-xs font-semibold text-zinc-500"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="grid gap-3 px-5 py-4" aria-label={`Capítulos — ${TAB_LABELS[activeTab]}`}>
          {activeTab === "profile" ? profileChapters.map((chapter) => (
            <NarrativeMapReadingChapterCard key={chapter.id} chapter={chapter} onOpen={setActiveChapter} />
          )) : null}

          {activeTab === "readings" ? (
            <>
              <div className="rounded-[1.35rem] bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-zinc-950">{viewModel.readings.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{viewModel.readings.description}</p>
              </div>
              {viewModel.readings.items.map((reading) => (
                <article key={reading.id} className="rounded-[1.35rem] bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-zinc-500">{reading.dateLabel}</p>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-950">{reading.contributionLabel}</p>
                      <h3 className="mt-1 text-base font-semibold leading-6 text-zinc-950">{reading.rememberedAs}</h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                      {reading.statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{reading.profileImpactPreview}</p>
                  <button
                    type="button"
                    className="mt-3 rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700"
                    onClick={() => setActiveReading(reading)}
                  >
                    {reading.action.label}
                  </button>
                </article>
              ))}
              {viewModel.readings.emptyState ? (
                <div className="rounded-[1.35rem] bg-white p-4 text-center shadow-sm">
                  <h3 className="text-base font-semibold text-zinc-950">{viewModel.readings.emptyState.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{viewModel.readings.emptyState.description}</p>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === "opportunities" ? (
            <>
              <div className="rounded-[1.35rem] bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-zinc-950">{viewModel.opportunities.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{viewModel.opportunities.description}</p>
              </div>
              {viewModel.opportunities.items.map((item) => (
                <article key={item.id} className="rounded-[1.35rem] bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-zinc-500">
                    {item.type === "brand_territory"
                      ? "Territórios em formação"
                      : item.type === "media_kit_bridge"
                        ? "Ponte para Mídia Kit"
                        : "Tipo de collab possível"}
                  </p>
                  <h3 className="mt-2 text-base font-semibold leading-6 text-zinc-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{item.preview}</p>
                </article>
              ))}
              {viewModel.opportunities.emptyState ? (
                <div className="rounded-[1.35rem] bg-white p-4 text-center shadow-sm">
                  <h3 className="text-base font-semibold text-zinc-950">{viewModel.opportunities.emptyState.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{viewModel.opportunities.emptyState.description}</p>
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        {presentation.safetyNote ? (
          <p className="mx-5 mb-5 rounded-2xl bg-white px-3 py-2 text-xs font-medium leading-5 text-zinc-500">
            {presentation.safetyNote}
          </p>
        ) : null}

        <NarrativeMapSnapshotReviewPanel review={snapshotReview} internal={internalReview} />
        {stateNav}
        <NarrativeMapReadingChapterModal chapter={activeChapter} onClose={() => setActiveChapter(null)} />
        <ReadingDetailModal reading={activeReading} onClose={() => setActiveReading(null)} />
        <NarrativeMapReadingFullDiagnosisModal
          presentation={presentation}
          open={fullDiagnosisOpen}
          onClose={() => setFullDiagnosisOpen(false)}
        />
      </section>
    </div>
  );
}
