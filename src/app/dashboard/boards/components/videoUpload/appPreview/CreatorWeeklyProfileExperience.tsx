"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";
import type { DiagnosticoPageData } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import { CREATOR_WEEKLY_REPORT_DEMO } from "@/app/lib/creatorWeeklyReport/demoReport";
import {
  buildPatternHighlights,
  formatPatternIndex,
  type PatternHighlight,
} from "@/app/lib/creatorWeeklyReport/patternHighlights";
import type {
  CreatorWeeklyReportPayload,
  CreatorWeeklyReportVideo,
} from "@/app/lib/creatorWeeklyReport/types";
import type { PaywallContext } from "@/types/paywall";
import type { PatternContext } from "@/app/lib/creatorWeeklyReport/patternContextTypes";
import type { WeeklyMeetingProfileData } from "./WeeklyMeetingProfileCard";
import type { IMapaData } from "@/app/models/MapaSeed";
import { ProfileIdentityCard, ProfileToolCards } from "./ProfileIdentityCard";
import { ProfileNarrativeView } from "./ProfileNarrativeView";
import { ProfileProSheet } from "./ProfileProSheet";
import { ProfilePatternSections } from "./ProfilePatternSections";
import { ProfilePatternDetailSheet } from "./ProfilePatternDetailSheet";
import { ProfileSectionHeader } from "./ProfileSectionHeader";
import { ProfileTerritoryTrends, type TerritoryTrendPost } from "./ProfileTerritoryTrends";
import { ProfileMeetingsCard } from "./ProfileMeetingsCard";
import { ProfileNextStepField, resolveNextStepFieldState } from "./ProfileNextStepField";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";

function firstName(value: string | null | undefined) {
  return value?.trim().split(/\s+/)[0] || "Criadora";
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
        {/* Sem repetir "Vídeo da semana": o cabeçalho da seção logo acima já
            nomeou o assunto, e o rótulo interno virava eco. */}
        {isDemo ? <span className="ds-badge ds-badge--neutral">Dados de exemplo</span> : null}
        {/* O veredito vem antes da manchete: é o que a pessoa veio saber. */}
        {formatIndex(video.performanceIndex) ? (
          <p className={`${isDemo ? "mt-2" : ""} text-[1.625rem] font-extrabold leading-none tracking-[-0.02em] text-[var(--ds-color-success)]`}>{formatIndex(video.performanceIndex)}</p>
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
  context,
  reportTag,
  territoryExample,
  onExpandPattern,
  onLockedPattern,
}: {
  report: CreatorWeeklyReportPayload;
  isDemo: boolean;
  /** Série das últimas semanas e ranking do território. Chega depois da tela. */
  context: PatternContext | null;
  /** O estado da leitura: "Exemplo", "Pausado", "Parado em 10 de agosto". */
  reportTag: string | null;
  territoryExample: TerritoryTrendPost | null;
  onExpandPattern: (highlight: PatternHighlight) => void;
  /** Toque num card bloqueado: abre o convite do Pro no contexto do padrão. */
  onLockedPattern: () => void;
}) {
  const [openPattern, setOpenPattern] = useState<PatternHighlight | null>(null);
  const highlights = buildPatternHighlights(report);
  const detailOf = (highlight: PatternHighlight) =>
    report.details.find((detail) => detail.id === highlight.detailId) ?? null;

  return (
    <div
      id="weekly-report"
      aria-describedby={isDemo ? "weekly-report-demo-notice" : undefined}
      className="flex flex-col"
    >
      {isDemo ? (
        <div role="note" className="ds-notebook-note mt-3">
          <p id="weekly-report-demo-notice" className="m-0">
            <strong className="text-[var(--ds-color-ink)]">Você está vendo dados de exemplo.</strong>{" "}
            Eles mostram como a leitura será organizada. Com o Instagram conectado, os padrões abaixo passam a ser os do seu perfil.
          </p>
        </div>
      ) : null}

      {/* Os padrões separados pela força da evidência: o que já é regra, o que
          ainda é aposta e o que a leitura olhou sem achar nada. */}
      <ProfilePatternSections
        highlights={highlights}
        context={context}
        locked={isDemo}
        reportTag={reportTag}
        onOpenPattern={(highlight) => {
          setOpenPattern(highlight);
          onExpandPattern(highlight);
        }}
        onLockedClick={onLockedPattern}
      />

      {/* O vídeo da semana é dado real e continua na tela — depois dos padrões,
          porque ele ilustra o que os padrões explicam. */}
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

      <ProfilePatternDetailSheet
        highlight={openPattern}
        detail={openPattern ? detailOf(openPattern) : null}
        context={context}
        territoryExample={territoryExample}
        onClose={() => setOpenPattern(null)}
      />
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
  const [patternContext, setPatternContext] = useState<PatternContext | null>(null);
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [proSheetOpen, setProSheetOpen] = useState(false);
  const [mapa, setMapa] = useState<IMapaData | null>((data.mapaSeed as IMapaData | null) ?? null);
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
  useEffect(() => setMapa((data.mapaSeed as IMapaData | null) ?? null), [data.mapaSeed]);
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

  const declaredNarrative = mapa?.narrativa_central?.trim()
    || data.synthesis.mainNarrative?.label?.trim()
    || "";
  const hasStarterMap = Boolean(
    mapa?.narrativa_central?.trim() || data.onboardingAnswers?.creatorPurpose?.trim(),
  );
  // Sem mapa declarado, o que existe é uma narrativa INFERIDA da síntese dos
  // vídeos — e exibi-la entre aspas, como se fosse a frase da pessoa, faria a
  // tela dizer que o trabalho já está feito. Nesse estado o card pede a resposta.
  const narrativeIsPlaceholder = !hasStarterMap || declaredNarrative.length === 0;
  const narrative = narrativeIsPlaceholder ? "" : declaredNarrative;
  const territories = useMemo(() => {
    const fromMap = mapa?.territorios?.filter(Boolean) ?? [];
    if (fromMap.length > 0) return fromMap.slice(0, 8);
    return data.synthesis.narrativeTerritories.map((territory) => territory.label).filter(Boolean).slice(0, 8);
  }, [mapa?.territorios, data.synthesis.narrativeTerritories]);

  // Os chips embaixo da narrativa são os assuntos que a LEITURA reconheceu nos
  // posts — não os territórios declarados. Era isso que o ✓ tentava dizer
  // marcando alguns chips e deixando outros sem marca: uma lista com dois
  // significados dentro. Havendo leitura, ela manda; sem leitura ainda, os
  // territórios do mapa entram como o que a pessoa declarou.
  const observedSubjects = hasReportAccess ? liveReport?.overview.observedSubjects ?? [] : [];
  const identitySubjects = (observedSubjects.length > 0 ? observedSubjects : territories).slice(0, 6);
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
  const instagramConnectionState =
    data.instagramConnectionState ?? (data.instagramConnected ? "connected" : "disconnected");
  const nextStepState = resolveNextStepFieldState({
    accessState: data.accessState,
    hasActivePro,
    hasStarterMap,
    instagramConnectionState,
  });

  // A NARRATIVA É INDEPENDENTE DE TUDO. Ela mora no card de identidade e aparece
  // sempre que falta — não é uma etapa de onboarding que trava as outras.
  //
  // Por isso o campo de ativação não para de pedir o resto enquanto ela não vem:
  // ele resolve o estado como se o mapa já existisse e mostra a pendência
  // SEGUINTE (assinar, conectar), ou some quando não há nenhuma. Sem isso, quem
  // pulou a narrativa nunca era convidado a assinar nem a conectar o Instagram,
  // e quem já tinha os dois perdia a linha de confirmação por causa de um campo
  // que não tem nada a ver com a saúde da conta.
  const activationState =
    nextStepState === "define_north"
      ? resolveNextStepFieldState({
          accessState: data.accessState,
          hasActivePro,
          hasStarterMap: true,
          instagramConnectionState,
        })
      : nextStepState;

  const mediaKitNote = data.userInfo.handle ? `@${data.userInfo.handle.replace(/^@/, "")}` : "sua página para marcas";

  /**
   * A etiqueta do estado da leitura, no canto do primeiro cabeçalho de padrões.
   * "Exemplo" quando os dados não são dele; "Pausado" e "Parado em…" quando são
   * dele mas pararam de atualizar — e essas três coisas não são a mesma.
   */
  const reportTag = reportIsDemo
    ? "Exemplo"
    : billingAttention
      ? "Pausado"
      : instagramConnectionState === "expired"
        ? "Leitura parada"
        : null;

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

  // A série de 4 semanas e o ranking do território chegam DEPOIS da tela: são
  // enriquecimento de cards que já estão desenhados. Falhar aqui não muda nada
  // do que está escrito — some a barrinha e some a coluna de comparação.
  useEffect(() => {
    if (!hasReportAccess) return;
    const controller = new AbortController();
    void fetch("/api/dashboard/mobile-strategic-profile/pattern-context", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload.context) return;
        setPatternContext(payload.context as PatternContext);
      })
      .catch(() => {
        /* silencioso: os cards continuam corretos sem série e sem território */
      });
    return () => controller.abort();
  }, [hasReportAccess]);

  // "Ver narrativa completa" abre a narrativa AQUI, sobre o Perfil, em vez de
  // trocar de rota: quem entra para conferir uma camada volta com um toque, e
  // não perde a posição de rolagem na leitura da semana. `onOpenFullMap` segue
  // sendo o sinal de "a pessoa pediu a narrativa completa" — quem escuta decide
  // o que fazer com isso (hoje, telemetria).
  const handleOpenNarrative = () => {
    setProSheetOpen(false);
    if (narrativeIsPlaceholder || !mapa) {
      onOpenNorte();
      return;
    }
    setNarrativeOpen(true);
    onOpenFullMap();
  };

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
        {/* Barra de marca e card de identidade vivem no MESMO wrapper porque no
            desktop o pai é um grid de áreas nomeadas: um filho solto, sem área,
            seria auto-posicionado numa linha implícita e desmontaria a coluna.
            No mobile o wrapper não faz nada — é só um div. */}
        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--map" : ""}>
        {/* O topo do app: a marca à esquerda, a conta à direita. A identidade
            da PESSOA desceu para o card logo abaixo — aqui em cima o que se
            reconhece é onde ela está, não quem ela é. */}
        <header className="flex items-center justify-between gap-3">
          <span className="text-[20px] font-bold leading-none tracking-[-0.045em] text-[var(--ds-color-ink)]" data-ds-display="true">
            data2content
          </span>
          <button type="button" className="ds-icon-button shrink-0" aria-label="Configurações da conta" onClick={onOpenAccountMenu}>
            <GearIcon />
          </button>
        </header>

        {/* Identidade, ferramentas e pendência dividem a mesma grade: os três
            respondem "onde eu estou e o que falta", e separados por seção viravam
            três assuntos onde há um. */}
        {/* No desktop a identidade acompanha a largura da COLUNA da leitura, não
            a da página inteira: esticada para 1216px, a narrativa terminava no
            meio do card e o "Ver narrativa completa" ficava órfão a meio metro
            do texto que ele completa. */}
        <div className={`mt-5 grid grid-cols-2 gap-3 ${surface === "responsive" ? "lg:max-w-[53.25rem]" : ""}`}>
          <ProfileIdentityCard
            userName={data.userInfo.name}
            userImageUrl={data.userInfo.imageUrl}
            headerSubtitle={hasReportAccess && liveReport ? `Semana de ${liveReport.period.rangeLabel}` : `Olá, ${firstName(data.userInfo.name)}`}
            narrative={narrative}
            narrativeIsPlaceholder={narrativeIsPlaceholder}
            subjects={identitySubjects}
            onOpenFullMap={handleOpenNarrative}
            onDefineNarrative={onOpenNorte}
            starterMapJustCreated={starterMapJustCreated}
            statusLine={activationState === "connected" ? (
              <ProfileNextStepField
                state="connected"
                lastReadAt={liveReport?.sourceMetricsUpdatedAt ?? liveReport?.generatedAt ?? null}
                onUpgrade={onUpgrade}
                onConnectInstagram={onConnectInstagram}
                onDefineNorth={onOpenNorte}
              />
            ) : null}
          />

          <ProfileToolCards
            isPro={hasActivePro}
            calculatorPrice={calculatorPrice}
            mediaKitReady={Boolean(data.userInfo.mediaKitSlug)}
            mediaKitNote={mediaKitNote}
            onOpenMediaKit={onOpenMediaKit}
            onOpenCalculator={onOpenCalculator}
          />
        </div>
        </div>

        {/* Saúde da conta: pede o plano, pede o Instagram, confirma — e volta a
            pedir se a conexão cair. Quando está tudo certo, o campo não ocupa
            espaço próprio: vira a linha discreta logo abaixo da narrativa.

            O pedido de narrativa não repete aqui: ele já é o corpo do card de
            identidade, e dois botões para a mesma ação na mesma tela leem como
            duas ações diferentes. Suprimido ele, o campo mostra a pendência
            SEGUINTE — que é o que a pessoa encontraria depois de responder. */}
        {activationState === "connected" || activationState === "none" ? null : (
          <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--activation" : ""}>
            <ProfileNextStepField
              state={activationState}
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
              context={patternContext}
              reportTag={reportTag}
              territoryExample={territoryTrends[0] ?? null}
              onExpandPattern={handleExpandPattern}
              onLockedPattern={() => setProSheetOpen(true)}
            />
          ) : (
            /* Primeiro acesso: a leitura ainda não fechou uma semana. O vazio
               fala da própria espera, com o prazo dito — "se atualiza sozinho"
               não responde a pergunta que a pessoa tem, que é QUANDO. */
            <section id="weekly-report" role="status" aria-live="polite">
              <ProfileSectionHeader title="Sua primeira leitura" />
              <div className="mt-4 rounded-[16px] border border-dashed border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-5">
                <h2 className="text-[20px] font-semibold leading-[1.26] tracking-[-0.025em] text-[var(--ds-color-ink)]">
                  Ainda lendo seus posts.
                </h2>
                <p className="mt-2.5 text-[13px] leading-[1.5] text-[var(--ds-color-text-secondary)]">
                  A leitura precisa de alguns vídeos para comparar. Na segunda que vem chega sua primeira leitura, com
                  os padrões que os seus posts mostrarem.
                </p>
              </div>
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

        {/* O rodapé é onde a régua é explicada uma vez só — e onde a tela diz de
            onde vem o que está acima. Três linhas, da mais específica para a mais
            geral: o aviso de exemplo, a cobertura da leitura, o ritmo da semana. */}
        <div
          className={`${surface === "responsive" ? "ds-profile-area ds-profile-area--footer" : ""} mt-[34px] flex flex-col gap-2 border-t border-dashed border-[var(--ds-color-line-strong)] pb-2 pt-[18px]`}
        >
          {/* O aviso de exemplo é explicação, não segunda oferta: o botão de
              ativar já está no campo acima, e repeti-lo aqui daria duas portas
              para a mesma ação — que se lê como duas ações diferentes. */}
          {reportIsDemo ? (
            <p className="text-[11.5px] leading-[1.5] text-[var(--ds-color-text-muted)]">
              O que aparece acima é um exemplo. Com o Pro e o Instagram conectado, a leitura passa a ser dos seus
              posts.
            </p>
          ) : null}
          {report ? (
            <p className="text-[11.5px] leading-[1.5] text-[var(--ds-color-text-muted)]">
              Tudo comparado com os seus últimos 90 dias · {report.coverage.postsWithScene} de{" "}
              {report.coverage.posts90d} posts lidos.
              {patternContext && patternContext.weeks > 1
                ? ` As barrinhas mostram as últimas ${patternContext.weeks} semanas.`
                : ""}
            </p>
          ) : null}
          <p className="text-[11.5px] leading-[1.5] text-[var(--ds-color-text-muted)] opacity-80">
            Segunda a leitura chega. Quinta a gente conversa sobre ela.
          </p>
        </div>
      </div>

      {/* A narrativa por inteiro, sobre o Perfil. */}
      {narrativeOpen ? (
        <ProfileNarrativeView
          mapa={mapa}
          narrative={narrative}
          observedSubjects={observedSubjects}
          coverageLine={
            hasReportAccess && liveReport
              ? `Atualizada a partir de ${liveReport.coverage.postsWithScene} de ${liveReport.coverage.posts90d} posts lidos nos últimos 90 dias.`
              : null
          }
          onClose={() => setNarrativeOpen(false)}
          onMapaChange={setMapa}
        />
      ) : null}

      {/* O convite do Pro, provocado por um padrão bloqueado. */}
      <ProfileProSheet
        open={proSheetOpen}
        narrativeActionLabel={
          narrativeIsPlaceholder || !mapa
            ? "Definir minha narrativa primeiro"
            : "Ver minha narrativa primeiro"
        }
        onUpgrade={() => {
          setProSheetOpen(false);
          onUpgrade("narrative_map");
        }}
        onOpenNarrative={handleOpenNarrative}
        onClose={() => setProSheetOpen(false)}
      />
    </main>
  );
}
