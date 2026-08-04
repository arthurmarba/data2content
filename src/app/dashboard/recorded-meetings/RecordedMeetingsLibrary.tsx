"use client";

import Image from "next/image";
import React from "react";
import { CalendarDays, Clock3, Search, Video, type LucideIcon } from "lucide-react";

import type { RecordedMeeting } from "@/app/lib/community/recordedMeetingsService";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function formatMeetingDate(value: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data não informada" : DATE_FORMATTER.format(date);
}

export default function RecordedMeetingsLibrary({
  meetings,
}: {
  meetings: RecordedMeeting[];
}) {
  const [selectedId, setSelectedId] = React.useState(meetings[0]?.id ?? "");
  const [query, setQuery] = React.useState("");
  const selectedMeeting =
    meetings.find((meeting) => meeting.id === selectedId) ?? meetings[0] ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredMeetings = React.useMemo(
    () =>
      normalizedQuery
        ? meetings.filter((meeting) =>
            `${meeting.title} ${meeting.description}`
              .toLocaleLowerCase("pt-BR")
              .includes(normalizedQuery),
          )
        : meetings,
    [meetings, normalizedQuery],
  );

  if (!selectedMeeting) {
    return (
      <section className="grid min-h-[430px] overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_18px_50px_rgba(24,24,27,0.045)] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
            <Video className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">
            Nenhuma gravação publicada
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
            A biblioteca está sendo preparada
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
            Assim que a primeira reunião for publicada, ela aparecerá aqui pronta para assistir.
          </p>
        </div>

        <aside className="border-t border-zinc-200/80 bg-zinc-50/70 px-7 py-9 lg:border-l lg:border-t-0" aria-label="Recursos da biblioteca">
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-zinc-400">
            Nesta biblioteca
          </p>
          <ul className="mt-6 space-y-6">
            <EmptyLibraryFeature
              icon={Video}
              title="Gravação completa"
              description="Assista às reuniões semanais no seu ritmo."
            />
            <EmptyLibraryFeature
              icon={CalendarDays}
              title="Arquivo por data"
              description="Encontre rapidamente a semana que deseja rever."
            />
            <EmptyLibraryFeature
              icon={Search}
              title="Busca no acervo"
              description="Pesquise reuniões por título ou assunto."
            />
          </ul>
        </aside>
      </section>
    );
  }

  return (
    <div className="grid min-h-0 gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
      <section className="min-w-0">
        <div className="overflow-hidden rounded-[1.5rem] bg-zinc-950 shadow-[0_22px_55px_rgba(24,24,27,0.16)]">
          <div className="aspect-video w-full">
            <iframe
              key={selectedMeeting.youtubeVideoId}
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${selectedMeeting.youtubeVideoId}?rel=0&modestbranding=1`}
              title={selectedMeeting.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <div className="px-1 pb-4 pt-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatMeetingDate(selectedMeeting.publishedAt)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-violet-700">
              <Clock3 className="h-3.5 w-3.5" /> Disponível para rever
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-zinc-950 sm:text-3xl">
            {selectedMeeting.title}
          </h2>
          {selectedMeeting.description ? (
            <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-zinc-600">
              {selectedMeeting.description}
            </p>
          ) : null}
        </div>
      </section>

      <aside className="min-h-0 xl:border-l xl:border-zinc-200 xl:pl-8">
        <div className="sticky top-0 bg-[#f7f7f5] pb-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">
                Arquivo
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">
                Todas as reuniões
              </h2>
            </div>
            <span className="text-xs font-semibold text-zinc-400">
              {meetings.length} {meetings.length === 1 ? "vídeo" : "vídeos"}
            </span>
          </div>
          <label className="mt-4 flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-zinc-500 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100">
            <Search className="h-4 w-4 shrink-0" />
            <span className="sr-only">Buscar reunião</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar reunião"
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </label>
        </div>

        <div className="divide-y divide-zinc-200/80">
          {filteredMeetings.map((meeting) => {
            const active = meeting.id === selectedMeeting.id;
            return (
              <button
                key={meeting.id}
                type="button"
                onClick={() => setSelectedId(meeting.id)}
                className="group flex w-full gap-3 py-4 text-left"
                aria-pressed={active}
              >
                <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-200 sm:w-32">
                  <Image
                    src={meeting.thumbnailUrl}
                    alt=""
                    fill
                    sizes="128px"
                    className={`object-cover transition duration-300 group-hover:scale-[1.03] ${
                      active ? "opacity-100" : "opacity-75 group-hover:opacity-100"
                    }`}
                  />
                  {active ? (
                    <span className="absolute inset-0 ring-2 ring-inset ring-violet-500" />
                  ) : null}
                </span>
                <span className="min-w-0 py-0.5">
                  <span
                    className={`line-clamp-2 text-sm font-semibold leading-5 ${
                      active ? "text-violet-800" : "text-zinc-800 group-hover:text-zinc-950"
                    }`}
                  >
                    {meeting.title}
                  </span>
                  <span className="mt-2 block text-xs text-zinc-400">
                    {formatMeetingDate(meeting.publishedAt)}
                  </span>
                </span>
              </button>
            );
          })}
          {filteredMeetings.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Nenhuma reunião encontrada.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function EmptyLibraryFeature({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-500 ring-1 ring-zinc-200/80">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-zinc-500">{description}</p>
      </div>
    </li>
  );
}
