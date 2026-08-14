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
  RecordedMeetingCatalogItem,
  RecordedMeetingPlayback,
  RecordedMeetingsStatus,
} from "@/app/lib/community/recordedMeetingsService";
import RecordedMeetingPlayerDialog from "@/app/dashboard/recorded-meetings/RecordedMeetingPlayerDialog";
import RecordedMeetingThumbnail from "@/app/dashboard/recorded-meetings/RecordedMeetingThumbnail";
import { RECORDED_MEETINGS_ROUTE } from "@/constants/routes";
import { openPaywallModal } from "@/utils/paywallModal";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

const DATE_FORMATTER_WITH_YEAR = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** "6 de agosto" no ano corrente; o ano só entra quando muda de fato o sentido. */
function formatMeetingDate(value: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return (sameYear ? DATE_FORMATTER : DATE_FORMATTER_WITH_YEAR).format(date);
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
  hasPlaybackAccess,
  initialMeetingId = null,
}: {
  meetings: RecordedMeetingCatalogItem[];
  status?: RecordedMeetingsStatus;
  hasPlaybackAccess: boolean;
  initialMeetingId?: string | null;
}) {
  const [query, setQuery] = React.useState("");
  const [playingMeeting, setPlayingMeeting] = React.useState<RecordedMeetingPlayback | null>(null);
  const [loadingMeetingId, setLoadingMeetingId] = React.useState<string | null>(null);
  const [playbackError, setPlaybackError] = React.useState<string | null>(null);
  const restoredMeetingRef = React.useRef(false);
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

  const openMeeting = React.useCallback(async (
    meeting: RecordedMeetingCatalogItem,
    source: string,
  ) => {
    setPlaybackError(null);
    if (!hasPlaybackAccess) {
      openPaywallModal({
        context: "recorded_meetings",
        source,
        returnTo: `${RECORDED_MEETINGS_ROUTE}?meeting=${encodeURIComponent(meeting.id)}`,
        postCheckoutIntent: "watch_recorded_meeting",
      });
      return;
    }

    setLoadingMeetingId(meeting.id);
    try {
      const response = await fetch(
        `/api/dashboard/recorded-meetings/${encodeURIComponent(meeting.id)}/playback`,
        { cache: "no-store", credentials: "include" },
      );
      const payload = await response.json().catch(() => null);
      if (response.status === 403) {
        openPaywallModal({
          context: "recorded_meetings",
          source,
          returnTo: `${RECORDED_MEETINGS_ROUTE}?meeting=${encodeURIComponent(meeting.id)}`,
          postCheckoutIntent: "watch_recorded_meeting",
        });
        return;
      }
      if (!response.ok || !payload?.ok || !payload?.meeting?.youtubeVideoId) {
        throw new Error("recorded_meeting_playback_unavailable");
      }
      setPlayingMeeting(payload.meeting as RecordedMeetingPlayback);
    } catch {
      setPlaybackError("Não foi possível abrir esta gravação agora. Tente novamente em instantes.");
    } finally {
      setLoadingMeetingId(null);
    }
  }, [hasPlaybackAccess]);

  React.useEffect(() => {
    if (restoredMeetingRef.current || !hasPlaybackAccess || !initialMeetingId) return;
    const meeting = meetings.find((candidate) => candidate.id === initialMeetingId);
    if (!meeting) return;
    restoredMeetingRef.current = true;
    void openMeeting(meeting, "recorded_meetings_checkout_return");
  }, [hasPlaybackAccess, initialMeetingId, meetings, openMeeting]);

  if (!featuredMeeting) {
    const unavailable = status === "unavailable" || status === "unconfigured";
    return (
      // Vazio não precisa de vitrine: a lista lateral com três "recursos da
      // biblioteca" virava uma coluna de texto que ninguém lê no celular.
      <section className="overflow-hidden rounded-[24px] border border-[#e7e1d8] bg-white lg:grid lg:min-h-[430px] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center sm:px-8 sm:py-14">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdecf1] text-[#c70a42]">
            <Video className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-[1.4rem] font-semibold leading-tight tracking-[-0.03em] text-[#17140f] sm:text-2xl">
            {unavailable ? "Não foi possível carregar as gravações" : "A primeira gravação ainda não saiu"}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#423b33]">
            {unavailable
              ? "Tente novamente em alguns minutos."
              : "Assim que uma reunião for publicada, ela aparece aqui."}
          </p>
        </div>

        <aside className="hidden border-zinc-200/80 bg-[#f7f3ed] px-7 py-9 lg:block lg:border-l" aria-label="Recursos da biblioteca">
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#6b6157]">
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

  // A busca só ganha espaço quando a lista deixa de caber na rolagem.
  const showSearch = meetings.length >= 8;

  return (
    <div className="min-w-0">
      {/* O destaque repetia a reunião mais recente, que aparece logo abaixo como
          primeiro item com o selo "mais recente" — 590px da primeira dobra do
          celular gastos duas vezes com a mesma coisa. No desktop ele cabe. */}
      <section className="hidden overflow-hidden rounded-[28px] bg-zinc-950 text-white shadow-[0_24px_70px_rgba(24,24,27,0.18)] lg:grid lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.4fr)]">
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
            <span>{meetings.length} {meetings.length === 1 ? "reunião" : "reuniões"}</span>
          </div>
          <button
            type="button"
            onClick={() => void openMeeting(featuredMeeting, "recorded_meetings_featured")}
            disabled={loadingMeetingId === featuredMeeting.id}
            className="mt-7 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-zinc-950 transition duration-200 hover:scale-[1.02] hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            {loadingMeetingId === featuredMeeting.id ? "Abrindo…" : "Assistir agora"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => void openMeeting(featuredMeeting, "recorded_meetings_featured_cover")}
          disabled={loadingMeetingId === featuredMeeting.id}
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

      <section className="lg:mt-10" aria-labelledby="recorded-meetings-catalog-title">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end lg:border-b lg:border-[#e7e1d8] lg:pb-5">
          {/* Sem o destaque acima, este par de títulos repetia o cabeçalho da
              página: "Reuniões gravadas" seguido de "Todas as reuniões". No
              desktop ele separa o destaque da lista e continua fazendo sentido. */}
          <div className="hidden lg:block">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c70a42]">
              Catálogo
            </p>
            <h2 id="recorded-meetings-catalog-title" className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#17140f]">
              {/* "Episódios" virava podcast; o produto inteiro chama de reunião. */}
              Todas as reuniões
            </h2>
          </div>
          {showSearch ? (
            <label className="flex min-h-11 w-full items-center gap-2 rounded-full border border-[#e7e1d8] bg-white px-4 text-[#6b6157] transition focus-within:border-[#c70a42] focus-within:ring-2 focus-within:ring-[#fdecf1] sm:w-72">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">Buscar reunião</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar reunião"
                className="w-full border-0 bg-transparent p-0 text-sm text-[#17140f] outline-none ring-0 placeholder:text-[#6b6157] focus:ring-0"
              />
            </label>
          ) : null}
        </div>

        {playbackError ? (
          <p role="status" className="mt-4 text-sm font-medium text-[#a61b43]">
            {playbackError}
          </p>
        ) : null}

        {filteredMeetings.length > 0 ? (
          <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {filteredMeetings.map((meeting, index) => (
              <button
                key={meeting.id}
                type="button"
                onClick={() => void openMeeting(meeting, "recorded_meetings_catalog")}
                disabled={loadingMeetingId === meeting.id}
                // active: existia só no mouse — no celular o toque não devolvia
                // sinal nenhum e a pessoa tocava duas vezes.
                className="group min-w-0 text-left transition duration-150 active:scale-[0.985] active:opacity-90 focus-visible:outline-none"
                aria-label={`Assistir ${meeting.title}`}
              >
                <span
                  className="relative block w-full overflow-hidden rounded-2xl bg-zinc-900 shadow-[0_12px_32px_rgba(24,24,27,0.1)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_42px_rgba(24,24,27,0.18)] group-focus-visible:ring-2 group-focus-visible:ring-[#c70a42]"
                  style={{ aspectRatio: "16 / 9" }}
                >
                  <RecordedMeetingThumbnail
                    meeting={meeting}
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="transition duration-500 group-hover:scale-[1.035]"
                  />
                  {/* O gradiente escurecia a capa sem ter texto para contrastar. */}
                  <span className="absolute bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg transition group-hover:scale-110">
                    <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
                  </span>
                  {index === 0 ? (
                    <span className="absolute right-3 top-3 rounded-full bg-zinc-950/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur">
                      Mais recente
                    </span>
                  ) : null}
                </span>
                <span className="mt-3 flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    {/* Três linhas: o título é a única pista do assunto — cortá-lo
                        em duas deixava só a data. */}
                    <span className="line-clamp-3 text-[15px] font-semibold leading-[1.35] text-[#17140f] transition group-hover:text-[#c70a42]">
                      {meeting.title}
                    </span>
                    <span className="mt-1.5 block text-xs font-medium text-[#6b6157]">
                      {formatMeetingDate(meeting.publishedAt)}
                    </span>
                  </span>
                  <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-[#d6cec2] transition group-hover:translate-x-0.5 group-hover:text-[#c70a42]" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Search className="mx-auto h-6 w-6 text-[#d6cec2]" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-[#423b33]">Nenhuma reunião encontrada.</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-3 min-h-11 px-3 text-sm font-bold text-[#c70a42] transition active:opacity-70"
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
