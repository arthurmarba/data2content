"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, Calculator } from "lucide-react";
import Link from "next/link";
import { COMMUNITY_PRO_JOIN_ROUTE } from "@/app/lib/communityLinks";
import { CREATOR_PROFILE_ROUTE, RECORDED_MEETINGS_ROUTE } from "@/constants/routes";
import type { DiagnosticoPageData } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import { CREATOR_WEEKLY_REPORT_DEMO } from "@/app/lib/creatorWeeklyReport/demoReport";
import type {
  CreatorWeeklyReportDetailId,
  CreatorWeeklyReportPayload,
  CreatorWeeklyReportVideo,
} from "@/app/lib/creatorWeeklyReport/types";
import type { PaywallContext } from "@/types/paywall";
import type { WeeklyMeetingProfileData } from "./WeeklyMeetingProfileCard";
import { CreatorWeeklyReportDetail } from "./CreatorWeeklyReportDetail";
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

function formatIndex(value: number | null) {
  if (value === null) return null;
  return `${value.toFixed(1).replace(".", ",")}× acima do seu normal`;
}

function formatMeetingDate(meeting: WeeklyMeetingProfileData) {
  const date = new Date(meeting.startAt);
  if (Number.isNaN(date.getTime())) return "Toda quinta, 19h";
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function GearIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 20.83V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9 1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  // Linha de navegação, não botão: elas levam para outra tela em vez de
  // executar algo aqui — a seta é a promessa correta, o botão prometeria demais.
  const rows = [
    {
      id: "media-kit",
      icon: <BriefcaseBusiness className="h-[18px] w-[18px]" strokeWidth={1.8} />,
      title: "Mídia Kit",
      subtitle: "Sua página para marcas",
      value: null as string | null,
      action: onOpenMediaKit,
    },
    {
      id: "calculator",
      icon: <Calculator className="h-[18px] w-[18px]" strokeWidth={1.8} />,
      title: "Quanto vale sua publi",
      // Uma linha que devolve um número se justifica; uma que só se anuncia, não.
      subtitle: isPro && calculatorPrice ? "Último cálculo · Reels" : "Calcule seu preço justo",
      value: isPro ? calculatorPrice : null,
      action: onOpenCalculator,
    },
  ];
  return (
    <section className="ds-notebook-section" aria-labelledby="profile-tools-title">
      <h2 id="profile-tools-title" className="ds-notebook-label mb-1">{isPro ? "Ferramentas" : "Ferramentas incluídas no Pro"}</h2>
      <div className="ds-notebook-divided">
        {rows.map((row) => (
          <button key={row.id} type="button" onClick={row.action} className="ds-notebook-row">
            <span className="text-[var(--ds-color-text-secondary)]">{row.icon}</span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-[var(--ds-color-ink)]">{row.title}</span>
              <span className="mt-0.5 block text-[12px] leading-[1.35] text-[var(--ds-color-text-muted)]">{row.subtitle}</span>
            </span>
            {isPro ? (
              <span className="flex items-center gap-2 text-[var(--ds-color-text-muted)]">
                {row.value ? <b className="text-[15px] font-extrabold tabular-nums text-[var(--ds-color-ink)]">{row.value}</b> : null}
                <ChevronIcon />
              </span>
            ) : (
              // Etiqueta escrita no lugar do cadeado: um ícone de 12px em cinza
              // lê como enfeite, a palavra comunica na hora.
              <span className="ds-notebook-tag font-semibold text-[var(--ds-color-text-secondary)]">Pro</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function ActivationCard({
  accessState,
  hasStarterMap,
  telemetryRoute,
  onUpgrade,
  onDefineNorth,
}: {
  accessState: DiagnosticoPageData["accessState"];
  hasStarterMap: boolean;
  telemetryRoute: string;
  onUpgrade: (context?: PaywallContext) => void;
  onDefineNorth: () => void;
}) {
  // Administradores compartilham o mesmo entitlement do Pro, mesmo quando o
  // rótulo de cobrança ainda é "Free". Sem esta equivalência, a tela oferecia
  // assinatura a quem já tinha acesso e o CTA correto de Instagram desaparecia.
  const proAccess = accessState === "pro_needs_instagram"
    || accessState === "pro_instagram_connected"
    || accessState === "pro_quota_reached"
    || accessState === "admin";
  const paymentPending = accessState === "payment_pending";
  const paymentAction = accessState === "payment_action_needed";
  const billingAttention = paymentPending || paymentAction;

  if (billingAttention) {
    return (
      <section id="pro-activation" className="ds-notebook-section">
        <span className="ds-notebook-label">Assinatura</span>
        <h2 className="mt-3 text-[1.5rem] font-bold leading-[1.08] text-[var(--ds-color-ink)]">
          {paymentPending ? "Falta concluir o pagamento." : "Seu pagamento precisa ser atualizado."}
        </h2>
        <p className="ds-body mt-3">Seu mapa continua seguro. Resolva a cobrança para liberar novamente relatório, Collabs e ferramentas Pro.</p>
        <button type="button" className="ds-button ds-button--primary mt-5" onClick={() => onUpgrade("narrative_map")}>
          {paymentPending ? "Continuar pagamento" : "Atualizar pagamento"}
        </button>
      </section>
    );
  }

  if (!proAccess && !hasStarterMap) {
    return (
      <section className="ds-notebook-section">
        <span className="ds-notebook-label">Primeiro passo</span>
        <h2 className="mt-3 text-[1.5rem] font-bold leading-[1.08] text-[var(--ds-color-ink)]">Defina seu Norte para começar o mapa.</h2>
        <p className="ds-body mt-3">Conte para quem você cria e o que deseja provocar. A D2C transforma essa resposta no seu primeiro rascunho.</p>
        <button type="button" className="ds-button ds-button--primary mt-5" onClick={onDefineNorth}>Definir meu Norte</button>
      </section>
    );
  }

  if (proAccess) return null;

  return (
    <section id="pro-activation" className="ds-notebook-section">
      <span className="ds-notebook-label">Seu mapa começou</span>
      <h2 className="mt-2 text-[1.375rem] font-bold leading-[1.12] text-[var(--ds-color-ink)]">
        Seu mapa tomou forma. Agora ele pode evoluir com você.
      </h2>
      <p className="ds-body mt-3">
        No Pro, a D2C cruza seu Norte, seus conteúdos e o Instagram para transformar o mapa em relatório, pautas e direção prática toda semana.
      </p>
      <button type="button" className="ds-button ds-button--primary mt-4" onClick={() => {
        trackMobileNarrativeEvent("mobile_starter_map_upgrade_clicked", {
          route: telemetryRoute,
          accessState,
          isPro: false,
          actionType: "weekly_profile_map",
        });
        onUpgrade("narrative_map");
      }}>Assinar o Pro</button>
      <p className="ds-caption mt-3">Você pode continuar explorando seu mapa gratuitamente.</p>
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
}) {
  const observedNormalized = observedSubjects.map(normalizeForMatch);
  return (
    // Identidade e mapa no mesmo cartão: são a mesma pergunta — quem é você.
    // Separados por uma fronteira de cartão, o retrato virava enfeite de topo.
    <section
      id="creator-weekly-map"
      className={`ds-notebook-section ds-notebook-section--first transition-shadow duration-700 ${starterMapJustCreated ? "ring-2 ring-[var(--ds-color-brand)] ring-offset-4 ring-offset-[var(--ds-color-paper)]" : ""}`}
      aria-labelledby="creator-map-title"
    >
      <div className="ds-profile-identity flex items-center gap-4">
        <ProfileAvatar name={userName} imageUrl={userImageUrl} />
        <div className="min-w-0 flex-1">
          <h1 className="ds-profile-title truncate text-[1.3rem] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ds-color-ink)]">
            {userName || "Seu perfil"}
          </h1>
          <p className="mt-1 truncate text-[12.5px] text-[var(--ds-color-text-muted)]">{headerSubtitle}</p>
        </div>
        <button type="button" className="ds-icon-button shrink-0 self-start" aria-label="Configurações da conta" onClick={onOpenAccountMenu}>
          <GearIcon />
        </button>
      </div>

      <div className="my-5 h-px bg-[var(--ds-color-line)]" />

      <span className="ds-notebook-label">Seu mapa</span>
      {/* Vazio nunca ocupa o nível de título: promover a ausência de conteúdo
          faz o maior texto da tela ser justamente o que não existe ainda. */}
      {narrativeIsPlaceholder ? (
        <p id="creator-map-title" className="mt-3 text-[15px] leading-[1.5] text-[var(--ds-color-text-muted)]">
          {narrative}
        </p>
      ) : (
        <blockquote id="creator-map-title" className="mt-3 text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--ds-color-ink)]">
          “{narrative}”
        </blockquote>
      )}
      <div className="ds-profile-map-body mt-5">
        <span className="ds-notebook-label">Assuntos</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {territories.length > 0 ? territories.map((territory) => {
            const normalized = normalizeForMatch(territory);
            const observed = observedNormalized.some((subject) => subject.includes(normalized) || normalized.includes(subject));
            return (
              <span key={territory} className={`ds-notebook-tag ${observed ? "font-semibold text-[var(--ds-color-ink)]" : ""}`}>
                {observed ? "✓" : null} {territory}
              </span>
            );
          }) : <span className="ds-caption">Adicione os assuntos que fazem parte da sua história.</span>}
        </div>
        <p className="ds-caption mt-3">
          {hasVideoEvidence
            ? "O ✓ indica um assunto que também apareceu nos vídeos lidos."
            : "Isso é o que você escreveu ao criar a conta. Nenhum vídeo publicado confirmou esses assuntos ainda."}
        </p>
        <button type="button" className="ds-notebook-action mt-2" onClick={onOpenFullMap}>
          <span>Ver mapa completo</span>
          <span className="text-[var(--ds-color-text-muted)]"><ChevronIcon /></span>
        </button>
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
          <p className="mt-2 text-[1.5rem] font-extrabold leading-none tracking-[-0.02em] text-[var(--ds-color-success)]">{formatIndex(video.performanceIndex)}</p>
        ) : null}
        <h2 className="mt-2 text-[1.125rem] font-bold leading-[1.18] text-[var(--ds-color-ink)]">{video.description}</h2>
        <div className="mt-5 grid grid-cols-3 pt-1">
          <div><b className="block text-[16px] text-[var(--ds-color-ink)]">{formatMetric(video.views)}</b><span className="ds-caption">views</span></div>
          <div><b className="block text-[16px] text-[var(--ds-color-ink)]">{formatMetric(video.saved)}</b><span className="ds-caption">salvos</span></div>
          <div><b className="block text-[16px] text-[var(--ds-color-ink)]">{formatMetric(video.shares)}</b><span className="ds-caption">envios</span></div>
        </div>
        {video.openingLine ? <p className="mt-4 border-l-2 border-[var(--ds-color-line-strong)] pl-3 text-[13px] italic leading-[1.45] text-[var(--ds-color-text-secondary)]">“{video.openingLine}”</p> : null}
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
  isPro,
  showInstagramAction,
  onOpenDetail,
  onConnectInstagram,
}: {
  report: CreatorWeeklyReportPayload;
  isDemo: boolean;
  isPro: boolean;
  showInstagramAction: boolean;
  onOpenDetail: (id: CreatorWeeklyReportDetailId) => void;
  onConnectInstagram: () => void;
}) {
  return (
    <section
      id="weekly-report"
      aria-labelledby="weekly-report-title"
      aria-describedby={isDemo ? "weekly-report-demo-notice" : undefined}
      className="ds-notebook-section"
    >
      <div className="flex items-center gap-2">
        <span className="ds-notebook-label">Seu relatório</span>
        {isDemo ? <span className="ds-badge ds-badge--neutral">Dados de exemplo</span> : null}
      </div>
      <h2 id="weekly-report-title" className="mt-2 text-[1.75rem] font-bold leading-none tracking-[-0.025em] text-[var(--ds-color-ink)]">A semana por dentro</h2>

      {isDemo ? (
        <div role="note" className="ds-notebook-note mt-4">
          <p id="weekly-report-demo-notice" className="m-0">
            <strong className="text-[var(--ds-color-ink)]">Você está vendo dados de exemplo.</strong>{" "}
            Eles mostram como o relatório será organizado. Conecte o Instagram para ver os resultados do seu perfil e deixá-lo disponível para análises individuais nas reuniões semanais.
          </p>
          {showInstagramAction ? (
            <div className="mt-3">
              <button
                type="button"
                className={`ds-button ${isPro ? "ds-button--primary" : "ds-button--quiet"} ds-button--small`}
                onClick={onConnectInstagram}
              >
                Conectar Instagram
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* "90 dias" colado no título contradizia a seção, que fala da semana.
          Como linha de apoio ele explica a régua em vez de confundir. */}
      <p className={`ds-body ${isDemo ? "mt-5" : "mt-3"}`}>{report.overview.summary}</p>
      <p className="ds-caption mt-2">Tudo comparado com a sua mediana dos últimos 90 dias.</p>

      <div className="mt-5 grid grid-cols-3 py-2">
        {report.overview.numbers.map((number) => (
          <div key={number.label} className="border-r border-[var(--ds-color-line)] px-2 text-center first:pl-0 last:border-r-0 last:pr-0">
            <b className="block text-[1.25rem] leading-none text-[var(--ds-color-ink)]">{number.value}</b>
            <span className="mt-1 block text-[11px] leading-[1.25] text-[var(--ds-color-text-muted)]">{number.label}</span>
          </div>
        ))}
      </div>

      {report.weeklyVideo ? <div className="mt-6"><WeeklyVideoCard video={report.weeklyVideo} isDemo={isDemo} /></div> : (
        <div className="mt-6 py-3">
          <span className="ds-eyebrow">Vídeo da semana</span>
          <h3 className="mt-2 text-[1.25rem] font-bold text-[var(--ds-color-ink)]">Nenhum post na semana encerrada.</h3>
          <p className="ds-body mt-2">Os rankings de 90 dias continuam disponíveis abaixo.</p>
        </div>
      )}

      <div className="ds-notebook-divided mt-6">
        {report.details.map((detail) => (
          <button
            key={detail.id}
            type="button"
            onClick={() => onOpenDetail(detail.id)}
            className="grid min-h-[5rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-3 text-left active:bg-[var(--ds-color-neutral)]"
          >
            <span className="min-w-0">
              <span className="block text-[14px] font-bold text-[var(--ds-color-ink)]">{detail.title}</span>
              <span className="mt-1 block text-[12px] leading-[1.4] text-[var(--ds-color-text-muted)]">{detail.summary}</span>
            </span>
            <span className="text-[var(--ds-color-text-muted)]"><ChevronIcon /></span>
          </button>
        ))}
      </div>
      <p className="ds-caption mt-3">
        {isDemo ? "Dados de exemplo · " : null}
        {report.coverage.postsWithScene} de {report.coverage.posts90d} posts têm leitura visual. Rankings sem cobertura ficam honestamente vazios.
      </p>
    </section>
  );
}

function BrandMatchCard({
  match,
}: {
  match: DiagnosticoPageData["brandMatches"][number] | null;
}) {
  if (!match) return null;

  return (
    <section className="ds-notebook-section">
      <span className="ds-eyebrow">Marca que combina com você</span>
      <h2 className="mt-3 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">{match.brandName}</h2>
      {match.rationale ? <p className="ds-body mt-2">{match.rationale}</p> : null}
      {match.disclaimer ? <p className="ds-caption mt-3">{match.disclaimer}</p> : null}
    </section>
  );
}

function MeetingCard({
  meeting,
  isPro,
  whatsappGroupLinkOpened,
  onUpgrade,
  onOpenWhatsAppGroup,
}: {
  meeting: WeeklyMeetingProfileData | null;
  isPro: boolean;
  whatsappGroupLinkOpened: boolean;
  onUpgrade: (context?: PaywallContext) => void;
  onOpenWhatsAppGroup: () => void;
}) {
  const cancelled = meeting?.status === "cancelled";
  return (
    <section id="community-d2c" className="ds-notebook-section">
      <span className="ds-notebook-label">Comunidade D2C no WhatsApp</span>
      <h2 className="mt-2 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">
        Networking e comunicação diária
      </h2>
      <p className="ds-body mt-2">
        É por lá que criadores trocam experiências e recebem os avisos das reuniões semanais. Nas reuniões, a D2C analisa perfis e relatórios individualmente.
      </p>
      <p className="ds-caption mt-2">
        {cancelled ? "A próxima edição foi cancelada." : meeting ? `Próxima reunião · ${formatMeetingDate(meeting)}` : "Reuniões · toda quinta, às 19h"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {isPro ? (
          <a
            href={COMMUNITY_PRO_JOIN_ROUTE}
            target="_blank"
            rel="noreferrer"
            className="ds-button ds-button--primary ds-button--small no-underline"
            onClick={onOpenWhatsAppGroup}
          >
            {whatsappGroupLinkOpened ? "Abrir Comunidade D2C" : "Entrar na Comunidade D2C"}
          </a>
        ) : (
          <button type="button" className="ds-button ds-button--quiet ds-button--small" onClick={() => onUpgrade("community")}>
            Entrar no WhatsApp
          </button>
        )}
      </div>
    </section>
  );
}

function RecordedMeetingsCard() {
  return (
    <section id="recorded-meetings" className="ds-notebook-section">
      <span className="ds-notebook-label">Reuniões gravadas</span>
      <h2 className="mt-2 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">
        Assista às reuniões anteriores
      </h2>
      <p className="ds-body mt-2">
        Explore o catálogo. Assinantes podem reproduzir todos os encontros.
      </p>
      <Link href={RECORDED_MEETINGS_ROUTE} className="ds-button ds-button--quiet ds-button--small mt-4 no-underline">
        Ver gravações
      </Link>
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
  const [detailId, setDetailId] = useState<CreatorWeeklyReportDetailId | null>(null);
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
  const reportIsDemo = !hasReportAccess;
  const report = reportIsDemo ? CREATOR_WEEKLY_REPORT_DEMO : liveReport;
  const profileRoute = surface === "responsive" ? CREATOR_PROFILE_ROUTE : "/dashboard/boards/mobile-strategic-profile";

  useEffect(() => {
    const container = document.querySelector<HTMLElement>("[data-mobile-profile-scroll-container='true']");
    if (!container) return;
    if (typeof container.scrollTo === "function") container.scrollTo({ top: 0, behavior: "auto" });
    else container.scrollTop = 0;
  }, [detailId]);

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
  const activeDetail = detailId ? report?.details.find((detail) => detail.id === detailId) ?? null : null;
  const handleOpenDetail = (id: CreatorWeeklyReportDetailId) => {
    trackMobileNarrativeEvent("mobile_weekly_report_detail_opened", {
      route: profileRoute,
      accessState: data.accessState,
      isPro,
      instagramConnected: data.instagramConnected,
      actionType: id,
    });
    setDetailId(id);
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

  if (activeDetail) {
    return (
      <CreatorWeeklyReportDetail
        detail={activeDetail}
        isDemo={reportIsDemo}
        onBack={() => setDetailId(null)}
        surface={surface}
      />
    );
  }

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
          />
        </div>

        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--community" : ""}>
          <MeetingCard
            meeting={weeklyMeeting}
            isPro={hasActivePro}
            whatsappGroupLinkOpened={whatsappGroupLinkOpened}
            onUpgrade={onUpgrade}
            onOpenWhatsAppGroup={handleOpenWhatsAppGroup}
          />
        </div>

        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--recordings" : ""}>
          <RecordedMeetingsCard />
        </div>

        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--activation" : ""}>
          <ActivationCard
            accessState={data.accessState}
            hasStarterMap={hasStarterMap}
            telemetryRoute={profileRoute}
            onUpgrade={onUpgrade}
            onDefineNorth={onOpenNorte}
          />
        </div>

        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--report" : ""}>
          {report ? (
            <ReportOverview
              report={report}
              isDemo={reportIsDemo}
              isPro={hasActivePro}
              showInstagramAction={!billingAttention}
              onOpenDetail={handleOpenDetail}
              onConnectInstagram={onConnectInstagram}
            />
          ) : (
            <section id="weekly-report" className="ds-notebook-section" role="status" aria-live="polite">
              <span className="ds-notebook-label">Seu relatório</span>
              <h2 className="mt-2 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">Seus dados já estão chegando ao Perfil.</h2>
              <p className="ds-body mt-2">Esta seção se atualiza automaticamente depois da primeira sincronização.</p>
            </section>
          )}
        </div>

        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--brand" : ""}>
          {hasReportAccess && liveReport ? <BrandMatchCard match={data.brandMatches[0] ?? null} /> : null}
        </div>

        <div className={surface === "responsive" ? "ds-profile-area ds-profile-area--tools lg:hidden" : ""}>
          <UtilityPanel
            isPro={hasActivePro}
            calculatorPrice={calculatorPrice}
            onOpenMediaKit={onOpenMediaKit}
            onOpenCalculator={onOpenCalculator}
          />
        </div>

        <p className={`${surface === "responsive" ? "ds-profile-area ds-profile-area--footer" : ""} pb-2 pt-6 text-center text-[11px] leading-[1.45] text-[var(--ds-color-text-muted)]`}>
          Segunda o relatório chega. Quinta a gente conversa sobre ele.
        </p>
      </div>
    </main>
  );
}
