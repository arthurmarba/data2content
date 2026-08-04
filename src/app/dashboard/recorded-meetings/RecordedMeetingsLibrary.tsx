"use client";

import React from "react";
import {
  CalendarDays,
  ChevronRight,
  Play,
  Search,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";

import type {
  RecordedMeeting,
  RecordedMeetingsStatus,
} from "@/app/lib/community/recordedMeetingsService";
import RecordedMeetingPlayerDialog from "@/app/dashboard/recorded-meetings/RecordedMeetingPlayerDialog";
import RecordedMeetingThumbnail from "@/app/dashboard/recorded-meetings/RecordedMeetingThumbnail";

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

function getMeetingSummary(description: string) {
  const firstParagraph = description
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .find(Boolean);

  if (!firstParagraph) {
    return "Análises, referências e decisões práticas da reunião semanal da D2C.";
  }

  return firstParagraph.length > 260
    ? `${firstParagraph.slice(0, 257).trimEnd()}…`
    : firstParagraph;
}

export default function RecordedMeetingsLibrary({
  meetings,
  status = meetings.length > 0 ? "ready" : "empty",
}: {
  meetings: RecordedMeeting[];
  status?: RecordedMeetingsStatus;
}) {
  const [query, setQuery] = React.useState("");
  const [playingMeeting, setPlayingMeeting] = React.useState<RecordedMeeting | null>(null);
  const featuredMeeting = meetings[0] ?? null;
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

  if (!featuredMeeting) {
    const unavailable = status === "unavailable" || status === "unconfigured";
    return (
      <section className="grid min-h-[430px] overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_18px_50px_rgba(24,24,27,0.045)] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
            <Video className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">
            {unavailable ? "Biblioteca indisponível" : "Nenhuma gravação publicada"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
            {unavailable ? "Não foi possível carregar as gravações" : "A biblioteca está sendo preparada"}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
            {unavailable
              ? "Estamos ajustando o acesso ao acervo. Tente novamente em alguns minutos."
              : "Assim que a primeira reunião for publicada, ela aparecerá aqui pronta para assistir."}
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
    <div className="min-w-0">
      <section className="grid overflow-hidden rounded-[28px] bg-zinc-950 text-white shadow-[0_24px_70px_rgba(24,24,27,0.18)] lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col justify-center px-6 py-8 sm:px-9 sm:py-10 lg:px-12">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Última reunião
          </p>
          <h2 className="mt-4 text-2xl font-bold leading-tight tracking-[-0.035em] sm:text-3xl lg:text-4xl">
            {featuredMeeting.title}
          </h2>
          <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-6 text-zinc-300">
            {getMeetingSummary(featuredMeeting.description)}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatMeetingDate(featuredMeeting.publishedAt)}
            </span>
            <span>{meetings.length} {meetings.length === 1 ? "episódio" : "episódios"}</span>
          </div>
          <button
            type="button"
            onClick={() => setPlayingMeeting(featuredMeeting)}
            className="mt-7 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-zinc-950 transition duration-200 hover:scale-[1.02] hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Assistir agora
          </button>
        </div>

        <button
          type="button"
          onClick={() => setPlayingMeeting(featuredMeeting)}
          className="group relative block min-h-0 w-full overflow-hidden bg-zinc-900 text-left"
          style={{ aspectRatio: "16 / 9" }}
          aria-label={`Assistir ${featuredMeeting.title}`}
        >
          <RecordedMeetingThumbnail
            meeting={featuredMeeting}
            sizes="(max-width: 1024px) 100vw, 65vw"
            priority
            className="transition duration-500 group-hover:scale-[1.025]"
          />
          <span className="absolute inset-0 bg-gradient-to-r from-zinc-950/35 via-transparent to-transparent lg:from-zinc-950/85 lg:via-zinc-950/10" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-zinc-950 shadow-xl transition duration-200 group-hover:scale-110">
              <Play className="ml-1 h-6 w-6 fill-current" aria-hidden="true" />
            </span>
          </span>
        </button>
      </section>

      <section className="mt-10" aria-labelledby="recorded-meetings-catalog-title">
        <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">
              Catálogo
            </p>
            <h2 id="recorded-meetings-catalog-title" className="mt-1 text-2xl font-bold tracking-[-0.03em] text-zinc-950">
              Todos os episódios
            </h2>
          </div>
          <label className="flex min-h-11 w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-zinc-500 transition focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 sm:w-72">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Buscar reunião</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar reunião"
              className="w-full border-0 bg-transparent p-0 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:ring-0"
            />
          </label>
        </div>

        {filteredMeetings.length > 0 ? (
          <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {filteredMeetings.map((meeting, index) => (
              <button
                key={meeting.id}
                type="button"
                onClick={() => setPlayingMeeting(meeting)}
                className="group min-w-0 text-left focus-visible:outline-none"
                aria-label={`Assistir ${meeting.title}`}
              >
                <span
                  className="relative block w-full overflow-hidden rounded-2xl bg-zinc-900 shadow-[0_12px_32px_rgba(24,24,27,0.1)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_42px_rgba(24,24,27,0.18)] group-focus-visible:ring-2 group-focus-visible:ring-violet-500"
                  style={{ aspectRatio: "16 / 9" }}
                >
                  <RecordedMeetingThumbnail
                    meeting={meeting}
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="transition duration-500 group-hover:scale-[1.035]"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
                  <span className="absolute bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg transition group-hover:scale-110">
                    <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
                  </span>
                  {index === 0 ? (
                    <span className="absolute right-3 top-3 rounded-full bg-zinc-950/80 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
                      Mais recente
                    </span>
                  ) : null}
                </span>
                <span className="mt-4 flex items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-base font-semibold leading-5 text-zinc-900 transition group-hover:text-violet-800">
                      {meeting.title}
                    </span>
                    <span className="mt-2 block text-xs font-medium text-zinc-500">
                      {formatMeetingDate(meeting.publishedAt)}
                    </span>
                  </span>
                  <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-violet-700" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Search className="mx-auto h-6 w-6 text-zinc-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-zinc-600">Nenhuma reunião encontrada.</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-3 text-sm font-bold text-violet-800"
            >
              Limpar busca
            </button>
          </div>
        )}
      </section>

      <RecordedMeetingPlayerDialog
        meeting={playingMeeting}
        onClose={() => setPlayingMeeting(null)}
      />
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
