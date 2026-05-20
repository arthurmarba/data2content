"use client";

import {
  NARRATIVE_MAP_READING_PREVIEW_STATES,
  type NarrativeMapReadingPreviewFixture,
} from "./buildNarrativeMapReadingPreviewFixture";
import { NarrativeMapMobileShell } from "./NarrativeMapMobileShell";

function StateChip({
  state,
  active,
}: {
  state: string;
  active: boolean;
}) {
  return (
    <a
      href={`/dashboard/boards/mobile-strategic-profile-preview?state=${state}`}
      className={
        active
          ? "shrink-0 rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white"
          : "shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700"
      }
    >
      {state.replace("narrative_map_", "").replaceAll("_", " ")}
    </a>
  );
}

export function NarrativeMapReadingPreview({ fixture }: { fixture: NarrativeMapReadingPreviewFixture }) {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950">
      <div className="mx-auto grid max-w-5xl gap-5">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno — Mapa narrativo</p>
          <h1 className="mt-2 text-2xl font-semibold">Leituras em capítulos</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Harness mockado para validar cards curtos, leitura profunda sob demanda e variações de estado.
          </p>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Estados do mapa narrativo">
            {NARRATIVE_MAP_READING_PREVIEW_STATES.map((state) => (
              <StateChip key={state} state={state} active={state === fixture.id} />
            ))}
          </nav>
        </header>

        <NarrativeMapMobileShell
          viewModel={fixture.viewModel}
          presentation={fixture.presentation}
          statusText={fixture.creator.status}
          snapshotReview={fixture.synthesisSnapshotWrite}
          internalReview
        />
      </div>
    </main>
  );
}
