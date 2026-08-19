"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";
import type { DiagnosticoPageData } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import { CREATOR_WEEKLY_REPORT_DEMO } from "@/app/lib/creatorWeeklyReport/demoReport";
import {
  buildPatternHighlights,
  buildWeekHeadline,
  formatPatternIndex,
  type PatternHighlight,
} from "@/app/lib/creatorWeeklyReport/patternHighlights";
import type {
  CreatorWeeklyReportPayload,
  CreatorWeeklyReportVideo,
} from "@/app/lib/creatorWeeklyReport/types";
import type { PaywallContext } from "@/types/paywall";
import type { WeeklyMeetingProfileData } from "./WeeklyMeetingProfileCard";
import { ProfilePatternGrid } from "./ProfilePatternGrid";
import { ProfileSectionHeader } from "./ProfileSectionHeader";
import { ProfileTerritoryTrends, type TerritoryTrendPost } from "./ProfileTerritoryTrends";
import { ProfileMeetingsCard } from "./ProfileMeetingsCard";
import { ProfileNextStepField, resolveNextStepFieldState } from "./ProfileNextStepField";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";

function firstName(value: string | null | undefined) {
  return value?.trim().split(/\s+/)[0] || "Criadora";
}

function normalizeForMatch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function formatMetric(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/**
 * Uma régua só na tela inteira: o vídeo da semana dizia "× acima do seu normal"
 * e os cards de padrão, "× o seu normal". Duas frases para a mesma conta.
 */
const formatIndex = formatPatternIndex;

function GearIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 20.83V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9 1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileAvatar({ name, imageUrl }: { name: string | null; imageUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = firstName(name).charAt(0).toUpperCase();
  return (
    // 72px: retrato, não chip de conta. Sem foto o círculo é bege com a letra
    // escura — um disco preto de 72px pesaria mais do que a letra comunica.
    <div className="ds-profile-avatar grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ds-color-neutral)] text-[24px] font-extrabold text-[var(--ds-color-ink)]">
      {imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : initial}
    </div>
  );
}

function UtilityPanel({
  isPro,
  calculatorPrice,
  onOpenMediaKit,
  onOpenCalculator,
}: {
  isPro: boolean;
  calculatorPrice: string | null;
  onOpenMediaKit: () => void;
  onOpenCalculator: () => void;
}) {
  // Duas portas de trabalho logo abaixo do nome: o Mídia Kit e o preço da publi
  // são o que o criador abre quando uma marca chama, e chamar acontece a
  // qualquer hora — não é assunto de rodapé.
  const rows = [
    {
      id: "media-kit",
      title: "Mídia Kit",
      subtitle: "Sua página para marcas",
      action: onOpenMediaKit,
    },
    {
      id: "calculator",
      title: "Quanto vale sua publi",
      subtitle: isPro && calculatorPrice ? `Último cálculo · ${calculatorPrice}` : "Calcule seu preço justo",
      action: onOpenCalculator,
    },
  ];
  return (
    <section className="grid grid-cols-2 gap-2.5" aria-label="Ferramentas">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={row.action}
          className="rounded-[14px] border border-[var(--ds-color-line)] bg-[var(--ds-color-neutral)] px-[14px] py-[13px] text-left"
        >
          <span className="flex items-center justify-between gap-1.5">
            <span className="text-[14px] font-semibold leading-[1.2] text-[var(--ds-color-ink)]">{row.title}</span>
            <span aria-hidden="true" className="text-[14px] font-semibold text-[var(--ds-color-text-muted)]">›</span>
          </span>
          <span className="mt-1 block text-[11.5px] leading-[1.25] text-[var(--ds-color-text-muted)]">
            {row.subtitle}
          </span>
        </button>
      ))}
    </section>
  );
}

function CreatorMap({
  userName,
  userImageUrl,
  headerSubtitle,
  narrative,
  narrativeIsPlaceholder,
  territories,
  observedSubjects,
  hasVideoEvidence,
  onOpenFullMap,
  onOpenAccountMenu,
  starterMapJustCreated,
  statusLine,
  toolsSlot,
}: {
  userName: string | null;
  userImageUrl: string | null;
  headerSubtitle: string;
  narrative: string;
  narrativeIsPlaceholder: boolean;
  territories: string[];
  observedSubjects: string[];
  hasVideoEvidence: boolean;
  onOpenFullMap: () => void;
  onOpenAccountMenu: () => void;
  starterMapJustCreated: boolean;
  /** "✓ Instagram conectado · lido hoje às 11h" — confirmação, não card. */
  statusLine?: ReactNode;
  /** Mídia Kit e calculadora, entre o nome e o mapa. */
  toolsSlot?: ReactNode;
}) {
  const observedNormalized = observedSubjects.map(normalizeForMatch);
  const isObserved = (territory: string) => {
    const normalized = normalizeForMatch(territory);
    return observedNormalized.some((subject) => subject.includes(normalized) || normalized.includes(subject));
  };
  // A legenda do ✓ só faz sentido se algum ✓ existir na tela. Havendo vídeos
  // analisados mas nenhum assunto batendo, ela prometia uma marca que não está
  // em lugar nenhum.
  const hasCheckedSubject = territories.some(isObserved);
  return (
    // Identidade sem casca de cartão: o retrato e o nome abrem a página, e o
    // mapa vem logo abaixo sob o próprio cabeçalho de seção.
    <section
      id="creator-weekly-map"
      className={`transition-shadow duration-700 ${starterMapJustCreated ? "rounded-[var(--ds-radius-md)] ring-2 ring-[var(--ds-color-brand)] ring-offset-4 ring-offset-[var(--ds-color-paper)]" : ""}`}
      aria-labelledby="creator-map-title"
    >
      <div className="ds-profile-identity flex items-center gap-3">
        <ProfileAvatar name={userName} imageUrl={userImageUrl} />
        <div className="min-w-0 flex-1">
          <h1 className="ds-profile-title truncate text-[23px] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--ds-color-ink)]">
            {userName || "Seu perfil"}
          </h1>
          <p className="mt-1 truncate text-[12.5px] text-[var(--ds-color-text-muted)]">{headerSubtitle}</p>
        </div>
        <button type="button" className="ds-icon-button shrink-0" aria-label="Configurações da conta" onClick={onOpenAccountMenu}>
          <GearIcon />
        </button>
      </div>

      {toolsSlot ? <div className="mt-5">{toolsSlot}</div> : null}

      <ProfileSectionHeader title="Seu mapa" />

      <div className="ds-profile-map-body mt-4 rounded-[18px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-6">
        {/* Vazio nunca ocupa o nível de título: promover a ausência de conteúdo
            faz o maior texto da tela ser justamente o que não existe ainda. */}
        {narrativeIsPlaceholder ? (
          <p id="creator-map-title" className="text-[15px] leading-[1.5] text-[var(--ds-color-text-muted)]">
            {narrative}
          </p>
        ) : (
          <blockquote id="creator-map-title" className="text-[23px] font-semibold leading-[1.24] tracking-[-0.03em] text-[var(--ds-color-ink)]">
            “{narrative}”
          </blockquote>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {territories.length > 0 ? territories.map((territory) => {
            const observed = isObserved(territory);
            return (
              <span
                key={territory}
                className={`rounded-full border px-[11px] py-[5px] text-[12.5px] font-medium ${
                  observed
                    ? "border-[var(--ds-color-line-strong)] text-[var(--ds-color-ink)]"
                    : "border-[var(--ds-color-line)] text-[var(--ds-color-text-muted)]"
                }`}
              >
                {observed ? "✓ " : ""}{territory}
              </span>
            );
          }) : <span className="ds-caption">Adicione os assuntos que fazem parte da sua história.</span>}
        </div>

        <p className="ds-caption mt-3">
          {hasCheckedSubject
            ? "O ✓ marca os assuntos que também apareceram nos seus vídeos."
            : hasVideoEvidence
              ? "Seus vídeos já foram analisados, mas nenhum deles falou desses assuntos ainda."
              : "Isso é o que você escreveu ao criar a conta. Nenhum vídeo publicado confirmou esses assuntos ainda."}
        </p>

        <button type="button" className="mt-[18px] flex w-full items-center justify-between text-[13px] font-semibold text-[var(--ds-color-ink)]" onClick={onOpenFullMap}>
          <span>Ver mapa completo</span>
          <span aria-hidden="true">→</span>
        </button>

        {statusLine}
      </div>
    </section>
  );
}

function WeeklyVideoCard({ video, isDemo }: { video: CreatorWeeklyReportVideo; isDemo: boolean }) {
  const body = (
    <div className="ds-notebook-media">
      {/* A imagem só entra quando há uma capa real. Uma faixa vazia para dizer
          que ela não existe não ajuda a leitura e empurra o resultado para baixo. */}
      {!isDemo && video.thumbnailUrl ? (
        <div className="relative aspect-[16/10] bg-[var(--ds-color-ink)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt="Capa do vídeo da semana" className="h-full w-full object-cover opacity-85" />
        </div>
      ) : null}
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span className="ds-notebook-label">Vídeo da semana</span>
          {isDemo ? <span className="ds-badge ds-badge--neutral">Dados de exemplo</span> : null}
        </div>
        {/* O veredito vem antes da manchete: é o que a pessoa veio saber. */}
        {formatIndex(video.performanceIndex) ? (
          <p className="mt-2 text-[1.625rem] font-extrabold leading-none tracking-[-0.02em] text-[var(--ds-color-success)]">{formatIndex(video.performanceIndex)}</p>
        ) : null}
        <h2 className="mt-2 text-[1.25rem] font-bold leading-[1.18] text-[var(--ds-color-ink)]">{video.description}</h2>
        <div className="mt-5 grid grid-cols-3 pt-1">
          {/* As palavras do próprio Instagram: é lá que a pessoa confere. */}
          <div><b className="block text-[17px] font-extrabold text-[var(--ds-color-ink)]">{formatMetric(video.views)}</b><span className="ds-caption">visualizações</span></div>
          <div><b className="block text-[17px] font-extrabold text-[var(--ds-color-ink)]">{formatMetric(video.saved)}</b><span className="ds-caption">salvamentos</span></div>
          <div><b className="block text-[17px] font-extrabold text-[var(--ds-color-ink)]">{formatMetric(video.shares)}</b><span className="ds-caption">compartilhamentos</span></div>
        </div>
      </div>
    </div>
  );
  if (!isDemo && video.postLink) {
    return <a href={video.postLink} target="_blank" rel="noreferrer" className="block no-underline">{body}</a>;
  }
  return body;
}

function ReportOverview({
  report,
  isDemo,
  onExpandPattern,
  onUpgrade,
}: {
  report: CreatorWeeklyReportPayload;
  isDemo: boolean;
  onExpandPattern: (highlight: PatternHighlight) => void;
  onUpgrade: (context?: PaywallContext) => void;
}) {
  const highlights = buildPatternHighlights(report);
  // A manchete elege, entre dez respostas de peso visual igual, a que importa
  // nesta semana. Sem nada promovido, a leitura do relatório assume o lugar.
  const headline = buildWeekHeadline(highlights) ?? report.overview.summary;
  const weekNumbers = report.overview.numbers.length > 0
    ? report.overview.numbers.map((number) => `${number.value} ${number.label}`).join(" · ")
    : null;

  return (
    <div
      id="weekly-report"
      aria-describedby={isDemo ? "weekly-report-demo-notice" : undefined}
      className="flex flex-col"
    >
      {/* Cabeçalho de seção em vez de casca de cartão: o fio separa o assunto
          sem cobrar padding, e a tag da direita diz o estado do relatório. */}
      <ProfileSectionHeader title="Relatório da semana" tag={isDemo ? "Dados de exemplo" : null} />

      {isDemo ? (
        <div role="note" className="ds-notebook-note mt-3">
          <p id="weekly-report-demo-notice" className="m-0">
            <strong className="text-[var(--ds-color-ink)]">Você está vendo dados de exemplo.</strong>{" "}
            Eles mostram como o relatório será organizado. Com o Instagram conectado, os padrões abaixo passam a ser os do seu perfil.
          </p>
        </div>
      ) : null}

      <ProfilePatternGrid
        highlights={highlights}
        details={report.details}
        headline={headline}
        weekNumbers={weekNumbers}
        locked={isDemo}
        onExpand={onExpandPattern}
        onLockedClick={() => onUpgrade("narrative_map")}
      />

      {/* O vídeo da semana é dado real e continua na tela — em seção própria,
          depois dos padrões, porque ele ilustra o que os padrões explicam. */}
      {report.weeklyVideo ? (
        <>
          <ProfileSectionHeader title="Vídeo da semana" level="group" />
          <div className="mt-3">
            <WeeklyVideoCard video={report.weeklyVideo} isDemo={isDemo} />
          </div>
        </>
      ) : (
        <div>
          <ProfileSectionHeader title="Vídeo da semana" level="group" />
          <h3 className="mt-3 text-[1.25rem] font-bold text-[var(--ds-color-ink)]">Você não postou na semana passada.</h3>
          <p className="ds-body mt-2">O que já funcionou nos últimos 90 dias continua aqui embaixo.</p>
        </div>
      )}

      {/* A régua explicada uma vez só. */}
      <p className="ds-caption mt-3 px-0.5">
        {isDemo ? "Dados de exemplo · " : null}
        Tudo comparado com o que você costuma fazer nos últimos 90 dias · {report.coverage.postsWithScene} de {report.coverage.posts90d} posts já analisados. Quando ainda faltam vídeos analisados, o card diz isso em vez de chutar.
      </p>
    </div>
  );
}

function BrandMatchCard({
  match,
}: {
  match: DiagnosticoPageData["brandMatches"][number] | null;
}) {
  if (!match) return null;

  return (
    <section>
      <ProfileSectionHeader title="Marca que combina com você" />
      <div className="mt-4 rounded-[18px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-6">
        <h2 className="text-[19px] font-bold leading-[1.25] tracking-[-0.025em] text-[var(--ds-color-ink)]">{match.brandName}</h2>
        {match.rationale ? (
          <p className="mt-2 text-[13.5px] leading-[1.45] text-[var(--ds-color-text-secondary)]">{match.rationale}</p>
        ) : null}
        {match.disclaimer ? <p className="ds-caption mt-3">{match.disclaimer}</p> : null}
      </div>
    </section>
  );
}

export function CreatorWeeklyProfileExperience({
  data,
  weeklyMeeting,
  calculatorPrice = null,
  onOpenAccountMenu,
  onOpenNorte,
  onOpenFullMap,
  onOpenMediaKit,
  onOpenCalculator,
  onUpgrade,
  onConnectInstagram,
  starterMapJustCreated = false,
  surface = "mobile",
}: {
  data: DiagnosticoPageData;
  weeklyMeeting: WeeklyMeetingProfileData | null;
  /** Último cálculo de publi já formatado (ex.: "R$ 2.800"), quando existir. */
  calculatorPrice?: string | null;
  onOpenAccountMenu: () => void;
  onOpenNorte: () => void;
  onOpenFullMap: () => void;
  onOpenMediaKit: () => void;
  onOpenCalculator: () => void;
  onUpgrade: (context?: PaywallContext) => void;
  onConnectInstagram: () => void;
  starterMapJustCreated?: boolean;
  surface?: "mobile" | "responsive";
}) {
  const [liveReport, setLiveReport] = useState<CreatorWeeklyReportPayload | null>(data.creatorWeeklyReport ?? null);
  const viewedRef = useRef(false);
  const isAdmin = data.accessState === "admin";
  const isPro = data.userInfo.plan === "Pro"
    || data.accessState === "pro_needs_instagram"
    || data.accessState === "pro_instagram_connected"
    || data.accessState === "pro_quota_reached"
    || isAdmin;
  const billingAttention = data.accessState === "payment_pending" || data.accessState === "payment_action_needed";
  const hasActivePro = isPro && !billingAttention;
  const hasReportAccess = hasActivePro && data.instagramConnected;
  const [whatsappGroupLinkOpened, setWhatsappGroupLinkOpened] = useState(data.userInfo.whatsappGroupLinkOpened === true);
  const [territoryTrends, setTerritoryTrends] = useState<TerritoryTrendPost[]>([]);
  const [trendsLabel, setTrendsLabel] = useState<string | null>(null);
  const reportIsDemo = !hasReportAccess;
  const report = reportIsDemo ? CREATOR_WEEKLY_REPORT_DEMO : liveReport;
  const profileRoute = surface === "responsive" ? CREATOR_PROFILE_ROUTE : "/dashboard/boards/mobile-strategic-profile";

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackMobileNarrativeEvent("mobile_weekly_profile_viewed", {
      route: profileRoute,
      accessState: data.accessState,
      isPro,
      instagramConnected: data.instagramConnected,
      actionType: hasReportAccess ? liveReport?.status ?? "report_processing" : "demo_report",
    });
  }, [data.accessState, data.instagramConnected, hasReportAccess, isPro, liveReport?.status, profileRoute]);

  useEffect(() => setLiveReport(data.creatorWeeklyReport ?? null), [data.creatorWeeklyReport]);
  useEffect(() => setWhatsappGroupLinkOpened(data.userInfo.whatsappGroupLinkOpened === true), [data.userInfo.whatsappGroupLinkOpened]);

  useEffect(() => {
    if (!hasReportAccess || (liveReport?.coverage.posts90d ?? 0) > 0) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      attempts += 1;
      try {
        const response = await fetch("/api/dashboard/mobile-strategic-profile/weekly-report", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!cancelled && response.ok && payload?.report) {
          setLiveReport(payload.report);
          if ((payload.report.coverage?.posts90d ?? 0) > 0) {
            trackMobileNarrativeEvent("mobile_weekly_report_refresh_succeeded", {
              route: profileRoute,
              accessState: data.accessState,
              isPro,
              instagramConnected: data.instagramConnected,
              actionType: payload.report.status,
            });
          }
        }
        if (!cancelled && (payload?.report?.coverage?.posts90d ?? 0) === 0 && attempts < 10) {
          timer = setTimeout(refresh, 6000);
        }
      } catch {
        if (!cancelled && attempts < 10) timer = setTimeout(refresh, 6000);
      }
    };
    void refresh();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [data.accessState, data.instagramConnected, hasReportAccess, isPro, liveReport?.coverage.posts90d, profileRoute]);

  const declaredNarrative = data.mapaSeed?.narrativa_central?.trim()
    || data.synthesis.mainNarrative?.label?.trim()
    || "";
  const narrativeIsPlaceholder = declaredNarrative.length === 0;
  const narrative = narrativeIsPlaceholder
    ? "Sua história ainda está ganhando forma. Responda o Seu Norte para escrevê-la."
    : declaredNarrative;
  const hasStarterMap = Boolean(
    data.mapaSeed?.narrativa_central?.trim()
    || data.onboardingAnswers?.creatorPurpose?.trim(),
  );
  const territories = useMemo(() => {
    const fromMap = data.mapaSeed?.territorios?.filter(Boolean) ?? [];
    if (fromMap.length > 0) return fromMap.slice(0, 8);
    return data.synthesis.narrativeTerritories.map((territory) => territory.label).filter(Boolean).slice(0, 8);
  }, [data.mapaSeed?.territorios, data.synthesis.narrativeTerritories]);
  const handleExpandPattern = (highlight: PatternHighlight) => {
    trackMobileNarrativeEvent("mobile_weekly_report_detail_opened", {
      route: profileRoute,
      accessState: data.accessState,
      isPro,
      instagramConnected: data.instagramConnected,
      actionType: highlight.id,
    });
  };

  // O campo de próximo passo cuida só da saúde da conta: plano e conexão de dados.
  // Comunidade e reuniões são lugares permanentes e vivem no card de reuniões.
  const nextStepState = resolveNextStepFieldState({
    accessState: data.accessState,
    hasActivePro,
    hasStarterMap,
    instagramConnectionState:
      data.instagramConnectionState ?? (data.instagramConnected ? "connected" : "disconnected"),
  });

  // Inspiração no assunto: o que rendeu entre os criadores da D2C que publicam
  // sobre a mesma coisa. Quem decide "a mesma coisa" é o servidor — primeiro pela
  // gaveta em que os posts DESTE criador já caem, e só depois pelos territórios
  // do mapa, que nem sempre têm gaveta correspondente.
  const territoriesKey = territories.join("|");
  useEffect(() => {
    const controller = new AbortController();
    const query = territoriesKey
      .split("|")
      .filter(Boolean)
      .map((territory) => `territory=${encodeURIComponent(territory)}`)
      .join("&");
    void fetch(
      `/api/dashboard/mobile-strategic-profile/territory-trends${query ? `?${query}` : ""}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) return;
        setTerritoryTrends(Array.isArray(payload.posts) ? payload.posts : []);
        setTrendsLabel(typeof payload.label === "string" ? payload.label : null);
      })
      .catch(() => {
        /* silencioso: a seção some, o resto do Perfil segue */
      });
    return () => controller.abort();
  }, [territoriesKey]);

  const handleOpenWhatsAppGroup = () => {
    setWhatsappGroupLinkOpened(true);
    trackMobileNarrativeEvent("mobile_whatsapp_group_link_opened", {
      route: profileRoute,
      accessState: data.accessState,
      isPro: hasActivePro,
      instagramConnected: data.instagramConnected,
      actionType: whatsappGroupLinkOpened ? "community_reopen" : "community_join",
    });
  };

  return (
    <main className={`ds-notebook-page ds-analysis-editorial ${surface === "responsive" ? "ds-notebook-page--responsive" : ""}`}>
      <div className={surface === "responsive" ? "ds-profile-layout" : ""}>
        {/* Identidade sempre primeiro: em qualquer estado ela abre o app e vê
            o próprio perfil antes de qualquer cobrança ou relatório. */}
        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--map" : ""}>
          <CreatorMap
            userName={data.userInfo.name}
            userImageUrl={data.userInfo.imageUrl}
            headerSubtitle={hasReportAccess && liveReport ? `Semana de ${liveReport.period.rangeLabel}` : `Olá, ${firstName(data.userInfo.name)}`}
            narrative={narrative}
            narrativeIsPlaceholder={narrativeIsPlaceholder}
            territories={territories}
            observedSubjects={hasReportAccess ? liveReport?.overview.observedSubjects ?? [] : []}
            hasVideoEvidence={hasReportAccess && (liveReport?.coverage.postsWithScene ?? 0) > 0}
            onOpenFullMap={onOpenFullMap}
            onOpenAccountMenu={onOpenAccountMenu}
            starterMapJustCreated={starterMapJustCreated}
            statusLine={nextStepState === "connected" ? (
              <ProfileNextStepField
                state="connected"
                lastReadAt={liveReport?.sourceMetricsUpdatedAt ?? liveReport?.generatedAt ?? null}
                onUpgrade={onUpgrade}
                onConnectInstagram={onConnectInstagram}
                onDefineNorth={onOpenNorte}
              />
            ) : null}
            toolsSlot={
              /* Entre o nome e o mapa: quando uma marca chama, é aqui que a
                 pessoa vai — e marca chama a qualquer hora. */
              <UtilityPanel
                isPro={hasActivePro}
                calculatorPrice={calculatorPrice}
                onOpenMediaKit={onOpenMediaKit}
                onOpenCalculator={onOpenCalculator}
              />
            }
          />
        </div>

        {/* Saúde da conta: pede o plano, pede o Instagram, confirma — e volta a
            pedir se a conexão cair. Quando está tudo certo, o campo não ocupa
            espaço próprio: vira a linha discreta logo abaixo da narrativa. */}
        {nextStepState === "connected" ? null : (
          <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--activation" : ""}>
            <ProfileNextStepField
              state={nextStepState}
              onUpgrade={onUpgrade}
              onConnectInstagram={onConnectInstagram}
              onDefineNorth={onOpenNorte}
            />
          </div>
        )}

        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--report" : ""}>
          {report ? (
            <ReportOverview
              report={report}
              isDemo={reportIsDemo}
              onExpandPattern={handleExpandPattern}
              onUpgrade={onUpgrade}
            />
          ) : (
            <section id="weekly-report" className="ds-notebook-section" role="status" aria-live="polite">
              <span className="ds-notebook-label">Seu relatório</span>
              <h2 className="mt-2 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">Seus posts estão chegando.</h2>
              <p className="ds-body mt-2">Assim que os primeiros forem lidos, isto aqui se atualiza sozinho.</p>
            </section>
          )}
        </div>

        {territoryTrends.length > 0 ? (
          <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--trends" : ""}>
            <ProfileTerritoryTrends
              territory={trendsLabel ?? territories[0] ?? "seu assunto"}
              posts={territoryTrends}
            />
          </div>
        ) : null}

        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--brand" : ""}>
          {hasReportAccess && liveReport ? <BrandMatchCard match={data.brandMatches[0] ?? null} /> : null}
        </div>

        {/* Reuniões: o único assunto desta tela que se repete toda semana, e por
            isso o único com lugar fixo. Aparece igual para quem ainda não assina —
            o convite entra no play, não antes. */}
        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--community" : ""}>
          <ProfileMeetingsCard
            meeting={weeklyMeeting}
            isPro={hasActivePro}
            whatsappGroupLinkOpened={whatsappGroupLinkOpened}
            onUpgrade={onUpgrade}
            onOpenWhatsAppGroup={handleOpenWhatsAppGroup}
          />
        </div>

        <p className={`${surface === "responsive" ? "ds-profile-area ds-profile-area--footer" : ""} pb-2 pt-6 text-center text-[11px] leading-[1.45] text-[var(--ds-color-text-muted)]`}>
          Segunda o relatório chega. Quinta a gente conversa sobre ele.
        </p>
      </div>
    </main>
  );
}
