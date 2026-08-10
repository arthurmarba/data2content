"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { COMMUNITY_WHATSAPP_URL } from "@/app/lib/communityLinks";
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

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ProfileAvatar({ name, imageUrl }: { name: string | null; imageUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = firstName(name).charAt(0).toUpperCase();
  return (
    <div className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ds-color-ink)] text-[16px] font-extrabold text-white">
      {imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : initial}
    </div>
  );
}

function UtilityPanel({
  isPro,
  onOpenMediaKit,
  onOpenCalculator,
}: {
  isPro: boolean;
  onOpenMediaKit: () => void;
  onOpenCalculator: () => void;
}) {
  const rows = [
    { id: "media-kit", icon: "▤", title: "Mídia Kit", subtitle: isPro ? "Sua página para marcas" : "Sua página para marcas · incluído no Pro", action: onOpenMediaKit },
    { id: "calculator", icon: "R$", title: "Quanto vale sua publi", subtitle: isPro ? "Calcule seu preço justo" : "Seu preço justo · incluído no Pro", action: onOpenCalculator },
  ];
  return (
    <section className="overflow-hidden rounded-[20px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={row.action}
          className="grid min-h-[4.6rem] w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--ds-color-line)] px-4 text-left last:border-b-0 active:bg-[var(--ds-color-neutral)]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ds-color-neutral)] text-[12px] font-extrabold text-[var(--ds-color-ink)]">{row.icon}</span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-[var(--ds-color-ink)]">{row.title}</span>
            <span className="mt-0.5 block text-[11px] leading-[1.35] text-[var(--ds-color-text-muted)]">{row.subtitle}</span>
          </span>
          <span className="text-[var(--ds-color-text-muted)]">{isPro ? <ChevronIcon /> : <LockIcon />}</span>
        </button>
      ))}
    </section>
  );
}

function ActivationCard({
  accessState,
  onUpgrade,
  onConnectInstagram,
}: {
  accessState: DiagnosticoPageData["accessState"];
  onUpgrade: (context?: PaywallContext) => void;
  onConnectInstagram: () => void;
}) {
  // Administradores compartilham o mesmo entitlement do Pro, mesmo quando o
  // rótulo de cobrança ainda é "Free". Sem esta equivalência, a tela oferecia
  // assinatura a quem já tinha acesso e o CTA correto de Instagram desaparecia.
  const proNeedsInstagram = accessState === "pro_needs_instagram" || accessState === "admin";
  const paymentPending = accessState === "payment_pending";
  const paymentAction = accessState === "payment_action_needed";
  const billingAttention = paymentPending || paymentAction;

  if (billingAttention) {
    return (
      <section className="ds-editorial-panel p-5">
        <span className="ds-eyebrow">Assinatura</span>
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

  return (
    <section className="ds-editorial-panel p-5">
      <span className="ds-eyebrow">{proNeedsInstagram ? "Falta 1 passo" : "Faltam 2 passos"}</span>
      <h2 className="mt-3 text-[1.55rem] font-bold leading-[1.07] text-[var(--ds-color-ink)]">
        Você já contou quem você é. Agora falta a D2C ver os seus vídeos.
      </h2>
      <p className="ds-body mt-3">Dia, horário, cena e assunto são calculados com os seus próprios posts.</p>

      <ol className="mt-5 border-t border-[var(--ds-color-line)]">
        <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[var(--ds-color-line)] py-4">
          <span className={`grid h-8 w-8 place-items-center rounded-full text-[12px] font-extrabold ${proNeedsInstagram ? "bg-[var(--ds-color-success-soft)] text-[var(--ds-color-success)]" : "bg-[var(--ds-color-ink)] text-white"}`}>
            {proNeedsInstagram ? "✓" : "1"}
          </span>
          <div>
            <p className="m-0 text-[14px] font-bold text-[var(--ds-color-ink)]">Assinar o Pro</p>
            <p className="ds-caption mt-1">Libera relatório semanal, Mídia Kit, calculadora, Collabs e reunião.</p>
            {!proNeedsInstagram ? (
              <button type="button" className="ds-button ds-button--primary ds-button--small mt-3" onClick={() => onUpgrade("narrative_map")}>Assinar</button>
            ) : null}
          </div>
        </li>
        <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-4">
          <span className={`grid h-8 w-8 place-items-center rounded-full text-[12px] font-extrabold ${proNeedsInstagram ? "bg-[var(--ds-color-ink)] text-white" : "bg-[var(--ds-color-neutral)] text-[var(--ds-color-text-muted)]"}`}>2</span>
          <div>
            <p className="m-0 text-[14px] font-bold text-[var(--ds-color-ink)]">Conectar o seu Instagram</p>
            <p className="ds-caption mt-1">Você autoriza pelo próprio Instagram e pode desconectar quando quiser.</p>
            {proNeedsInstagram ? (
              <button type="button" className="ds-button ds-button--primary ds-button--small mt-3" onClick={onConnectInstagram}>Conectar Instagram</button>
            ) : null}
          </div>
        </li>
      </ol>

      <div className="rounded-[16px] bg-[var(--ds-color-neutral)] px-4 py-3 text-[12px] leading-[1.5] text-[var(--ds-color-text-secondary)]">
        <strong className="text-[var(--ds-color-ink)]">Sem uma fila depois da conexão.</strong> O relatório-base usa os posts já publicados; leituras visuais entram conforme ficam confiáveis.
      </div>
    </section>
  );
}

function CreatorMap({
  narrative,
  territories,
  observedSubjects,
  hasVideoEvidence,
  onOpenSettings,
}: {
  narrative: string;
  territories: string[];
  observedSubjects: string[];
  hasVideoEvidence: boolean;
  onOpenSettings: () => void;
}) {
  const observedNormalized = observedSubjects.map(normalizeForMatch);
  return (
    <section className="ds-editorial-panel p-5">
      <span className="ds-eyebrow">Seu mapa</span>
      <blockquote className="mt-3 text-[1.5rem] font-bold leading-[1.12] text-[var(--ds-color-ink)]">
        “{narrative}”
      </blockquote>
      <div className="mt-5 border-t border-[var(--ds-color-line)] pt-4">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-[var(--ds-color-text-muted)]">Seus assuntos</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {territories.length > 0 ? territories.map((territory) => {
            const normalized = normalizeForMatch(territory);
            const observed = observedNormalized.some((subject) => subject.includes(normalized) || normalized.includes(subject));
            return (
              <span key={territory} className={`ds-chip ${observed ? "ds-chip--active" : ""}`}>
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
        <button type="button" className="mt-3 min-h-10 text-[12px] font-bold text-[var(--ds-color-brand-strong)]" onClick={onOpenSettings}>
          Ajustar nas configurações
        </button>
      </div>
    </section>
  );
}

function WeeklyVideoCard({ video, isDemo }: { video: CreatorWeeklyReportVideo; isDemo: boolean }) {
  const body = (
    <div className="ds-editorial-panel overflow-hidden">
      <div className="relative aspect-[16/10] bg-[var(--ds-color-ink)]">
        {!isDemo && video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="Capa do vídeo da semana" className="h-full w-full object-cover opacity-85" />
        ) : (
          <div className="grid h-full place-items-center bg-[linear-gradient(145deg,var(--ds-color-line-strong),var(--ds-color-text-muted))] text-center text-[12px] font-bold text-white/80">
            {isDemo ? "Vídeo ocultado no exemplo" : "Capa indisponível"}
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white backdrop-blur-sm">Vídeo da semana</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span className="ds-eyebrow">O que mais rendeu</span>
          {isDemo ? <span className="ds-badge ds-badge--neutral">Exemplo</span> : null}
        </div>
        <h2 className="mt-3 text-[1.35rem] font-bold leading-[1.12] text-[var(--ds-color-ink)]">{video.description}</h2>
        {formatIndex(video.performanceIndex) ? <p className="mt-2 text-[13px] font-bold text-[var(--ds-color-success)]">{formatIndex(video.performanceIndex)}</p> : null}
        <div className="mt-5 grid grid-cols-3 border-t border-[var(--ds-color-line)] pt-4">
          <div><b className="block text-[16px] text-[var(--ds-color-ink)]">{formatMetric(video.views)}</b><span className="ds-caption">views</span></div>
          <div><b className="block text-[16px] text-[var(--ds-color-ink)]">{formatMetric(video.saved)}</b><span className="ds-caption">salvos</span></div>
          <div><b className="block text-[16px] text-[var(--ds-color-ink)]">{formatMetric(video.shares)}</b><span className="ds-caption">envios</span></div>
        </div>
        {video.openingLine ? <p className="mt-4 border-l-2 border-[var(--ds-color-brand)] pl-3 text-[13px] italic leading-[1.45] text-[var(--ds-color-text-secondary)]">“{video.openingLine}”</p> : null}
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
  onOpenDetail,
}: {
  report: CreatorWeeklyReportPayload;
  isDemo: boolean;
  onOpenDetail: (id: CreatorWeeklyReportDetailId) => void;
}) {
  return (
    <section aria-labelledby="weekly-report-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="ds-eyebrow">Seu relatório</span>
            {isDemo ? <span className="ds-badge ds-badge--neutral">Exemplo</span> : null}
          </div>
          <h2 id="weekly-report-title" className="mt-2 text-[1.75rem] font-bold leading-none text-[var(--ds-color-ink)]">A semana por dentro</h2>
        </div>
        <span className="ds-caption shrink-0">90 dias</span>
      </div>
      <p className="ds-body mt-3">{report.overview.summary}</p>

      <div className="mt-5 grid grid-cols-3 border-y border-[var(--ds-color-line)] py-4">
        {report.overview.numbers.map((number) => (
          <div key={number.label} className="border-r border-[var(--ds-color-line)] px-2 text-center first:pl-0 last:border-r-0 last:pr-0">
            <b className="block text-[1.25rem] leading-none text-[var(--ds-color-ink)]">{number.value}</b>
            <span className="mt-1 block text-[10px] leading-[1.2] text-[var(--ds-color-text-muted)]">{number.label}</span>
          </div>
        ))}
      </div>

      {report.weeklyVideo ? <div className="mt-6"><WeeklyVideoCard video={report.weeklyVideo} isDemo={isDemo} /></div> : (
        <div className="mt-6 rounded-[18px] bg-[var(--ds-color-neutral)] p-5">
          <span className="ds-eyebrow">Vídeo da semana</span>
          <h3 className="mt-2 text-[1.25rem] font-bold text-[var(--ds-color-ink)]">Nenhum post na semana encerrada.</h3>
          <p className="ds-body mt-2">Os rankings de 90 dias continuam disponíveis abaixo.</p>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-[20px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]">
        {report.details.map((detail) => (
          <button
            key={detail.id}
            type="button"
            onClick={() => onOpenDetail(detail.id)}
            className="grid min-h-[5.25rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--ds-color-line)] px-4 py-3.5 text-left last:border-b-0 active:bg-[var(--ds-color-neutral)]"
          >
            <span className="min-w-0">
              <span className="block text-[14px] font-bold text-[var(--ds-color-ink)]">{detail.title}</span>
              <span className="mt-1 block text-[11px] leading-[1.35] text-[var(--ds-color-text-muted)]">{detail.summary}</span>
            </span>
            <span className="text-[var(--ds-color-brand-strong)]"><ChevronIcon /></span>
          </button>
        ))}
      </div>
      <p className="ds-caption mt-3">{report.coverage.postsWithScene} de {report.coverage.posts90d} posts têm leitura visual. Rankings sem cobertura ficam honestamente vazios.</p>
    </section>
  );
}

function LockedBenefits() {
  const rows = [
    ["O vídeo da semana", "Qual vídeo rendeu mais e o motivo"],
    ["Dia e horário", "O melhor dia e a melhor hora para você"],
    ["Cena, tom e câmera", "Onde gravar, como falar e como se enquadrar"],
    ["Assuntos e aberturas", "Os temas e primeiras frases que mais rendem"],
  ];
  return (
    <section className="ds-editorial-panel p-5">
      <span className="ds-eyebrow">O que chega toda segunda</span>
      <h2 className="mt-3 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">Depois dos dois passos</h2>
      <div className="mt-3">
        {rows.map(([title, subtitle]) => (
          <div key={title} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[var(--ds-color-line)] py-3 last:border-b-0">
            <span><b className="block text-[13px] text-[var(--ds-color-ink)]">{title}</b><span className="ds-caption mt-1 block">{subtitle}</span></span>
            <span className="self-center text-[var(--ds-color-text-muted)]"><LockIcon /></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BrandMatchCard({
  match,
  isDemo,
}: {
  match: DiagnosticoPageData["brandMatches"][number] | null;
  isDemo: boolean;
}) {
  if (!isDemo && !match) return null;

  const brandName = isDemo ? "Uma marca de bem-estar" : match?.brandName;
  const rationale = isDemo
    ? "No relatório de exemplo, rotina possível e autocuidado aparecem entre os assuntos mais fortes."
    : match?.rationale;

  return (
    <section className="ds-editorial-panel p-5">
      <div className="flex items-center gap-2">
        <span className="ds-eyebrow">Marca que combina com você</span>
        {isDemo ? <span className="ds-badge ds-badge--neutral">Exemplo</span> : null}
      </div>
      <h2 className="mt-3 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">{brandName}</h2>
      {rationale ? <p className="ds-body mt-2">{rationale}</p> : null}
      {!isDemo && match?.disclaimer ? <p className="ds-caption mt-3">{match.disclaimer}</p> : null}
    </section>
  );
}

function MeetingCard({
  meeting,
  isPro,
  isDemo,
  onUpgrade,
}: {
  meeting: WeeklyMeetingProfileData | null;
  isPro: boolean;
  isDemo: boolean;
  onUpgrade: (context?: PaywallContext) => void;
}) {
  const cancelled = meeting?.status === "cancelled";
  return (
    <section className="border-t border-[var(--ds-color-line)] pt-6">
      <span className="ds-eyebrow">Reunião da comunidade</span>
      <h2 className="mt-2 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">
        {cancelled ? "Esta edição foi cancelada" : meeting ? formatMeetingDate(meeting) : "Toda quinta, 19h"}
      </h2>
      <p className="ds-body mt-2">Os criadores abrem os relatórios e dizem o que fariam diferente. É onde você descobre o que ninguém percebe sozinho.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {isPro && !isDemo ? (
          <>
            <Link href="/reuniao" className="ds-button ds-button--secondary ds-button--small no-underline">Entrar na reunião</Link>
            <a href={COMMUNITY_WHATSAPP_URL} target="_blank" rel="noreferrer" className="ds-button ds-button--quiet ds-button--small no-underline">Grupo Pro</a>
          </>
        ) : (
          <button type="button" className="ds-button ds-button--quiet ds-button--small" onClick={() => onUpgrade("mentoria")}>Participar das reuniões</button>
        )}
      </div>
    </section>
  );
}

export function CreatorWeeklyProfileExperience({
  data,
  weeklyMeeting,
  isDemo,
  onDemoChange,
  onOpenAccountMenu,
  onOpenMediaKit,
  onOpenCalculator,
  onUpgrade,
  onConnectInstagram,
}: {
  data: DiagnosticoPageData;
  weeklyMeeting: WeeklyMeetingProfileData | null;
  isDemo: boolean;
  onDemoChange: (demo: boolean) => void;
  onOpenAccountMenu: () => void;
  onOpenMediaKit: () => void;
  onOpenCalculator: () => void;
  onUpgrade: (context?: PaywallContext) => void;
  onConnectInstagram: () => void;
}) {
  const [liveReport, setLiveReport] = useState<CreatorWeeklyReportPayload | null>(data.creatorWeeklyReport ?? null);
  const [detailId, setDetailId] = useState<CreatorWeeklyReportDetailId | null>(null);
  const viewedRef = useRef(false);
  const isAdmin = data.accessState === "admin";
  const isPro = data.userInfo.plan === "Pro" || isAdmin;
  const hasReportAccess = isPro && data.instagramConnected;
  const report = isDemo ? CREATOR_WEEKLY_REPORT_DEMO : liveReport;

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
      route: "/dashboard/boards/mobile-strategic-profile",
      accessState: data.accessState,
      isPro,
      instagramConnected: data.instagramConnected,
      actionType: liveReport?.status ?? "without_report",
    });
  }, [data.accessState, data.instagramConnected, isPro, liveReport?.status]);

  useEffect(() => setLiveReport(data.creatorWeeklyReport ?? null), [data.creatorWeeklyReport]);

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
              route: "/dashboard/boards/mobile-strategic-profile",
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
  }, [data.accessState, data.instagramConnected, hasReportAccess, isPro, liveReport?.coverage.posts90d]);

  const narrative = data.mapaSeed?.narrativa_central?.trim()
    || data.synthesis.mainNarrative?.label?.trim()
    || "Sua história ainda está ganhando forma";
  const territories = useMemo(() => {
    const fromMap = data.mapaSeed?.territorios?.filter(Boolean) ?? [];
    if (fromMap.length > 0) return fromMap.slice(0, 8);
    return data.synthesis.narrativeTerritories.map((territory) => territory.label).filter(Boolean).slice(0, 8);
  }, [data.mapaSeed?.territorios, data.synthesis.narrativeTerritories]);
  const activeDetail = detailId ? report?.details.find((detail) => detail.id === detailId) ?? null : null;
  const handleDemoChange = (next: boolean) => {
    trackMobileNarrativeEvent(
      next ? "mobile_weekly_report_demo_opened" : "mobile_weekly_report_demo_closed",
      {
        route: "/dashboard/boards/mobile-strategic-profile",
        accessState: data.accessState,
        isPro,
        instagramConnected: data.instagramConnected,
      },
    );
    setDetailId(null);
    onDemoChange(next);
  };
  const handleOpenDetail = (id: CreatorWeeklyReportDetailId) => {
    trackMobileNarrativeEvent("mobile_weekly_report_detail_opened", {
      route: "/dashboard/boards/mobile-strategic-profile",
      accessState: data.accessState,
      isPro,
      instagramConnected: data.instagramConnected,
      actionType: id,
    });
    setDetailId(id);
  };

  if (activeDetail) {
    return <CreatorWeeklyReportDetail detail={activeDetail} isDemo={isDemo} onBack={() => setDetailId(null)} />;
  }

  return (
    <main className="mx-auto w-full max-w-[32rem] px-5 pb-8 pt-[var(--ds-safe-top)] ds-analysis-editorial">
      <header className="flex items-center gap-3">
        <ProfileAvatar name={data.userInfo.name} imageUrl={data.userInfo.imageUrl} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.05rem] font-extrabold leading-tight text-[var(--ds-color-ink)]">{data.userInfo.name || "Seu perfil"}</h1>
          <p className="mt-1 truncate text-[11px] text-[var(--ds-color-text-muted)]">
            {isDemo ? "Relatório de exemplo" : report ? `Semana de ${report.period.rangeLabel}` : `Olá, ${firstName(data.userInfo.name)}`}
          </p>
        </div>
        <button type="button" className="ds-icon-button" aria-label="Configurações da conta" onClick={onOpenAccountMenu}><GearIcon /></button>
      </header>

      <div className="mt-6 space-y-6">
        {!hasReportAccess && !isDemo ? (
          <ActivationCard accessState={data.accessState} onUpgrade={onUpgrade} onConnectInstagram={onConnectInstagram} />
        ) : null}

        <UtilityPanel isPro={isPro && !isDemo} onOpenMediaKit={isDemo ? () => onUpgrade("media_kit") : onOpenMediaKit} onOpenCalculator={isDemo ? () => onUpgrade("calculator") : onOpenCalculator} />

        <CreatorMap
          narrative={narrative}
          territories={territories}
          observedSubjects={report?.overview.observedSubjects ?? []}
          hasVideoEvidence={(report?.coverage.postsWithScene ?? 0) > 0 && !isDemo}
          onOpenSettings={onOpenAccountMenu}
        />

        {isDemo ? (
          <section className="rounded-[18px] bg-[var(--ds-color-brand-soft)] p-4 text-[13px] leading-[1.5] text-[var(--ds-color-brand-strong)]">
            <strong>Você está vendo um exemplo.</strong> Seu nome, sua foto e seu mapa continuam sendo seus; só os números abaixo são demonstrativos.
          </section>
        ) : null}

        {report && (hasReportAccess || isDemo) ? (
          <ReportOverview report={report} isDemo={isDemo} onOpenDetail={handleOpenDetail} />
        ) : hasReportAccess ? (
          <section className="rounded-[20px] bg-[var(--ds-color-neutral)] p-5" role="status" aria-live="polite">
            <span className="ds-eyebrow">Seu relatório</span>
            <h2 className="mt-2 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">Seus dados já estão chegando ao Perfil.</h2>
            <p className="ds-body mt-2">O mapa permanece disponível e esta seção se atualiza automaticamente depois da primeira sincronização.</p>
          </section>
        ) : (
          <LockedBenefits />
        )}

        {report && (hasReportAccess || isDemo) ? (
          <BrandMatchCard match={data.brandMatches[0] ?? null} isDemo={isDemo} />
        ) : null}

        {!hasReportAccess && !isDemo ? (
          <section className="border-t border-[var(--ds-color-line)] pt-6">
            <span className="ds-eyebrow">Veja por dentro</span>
            <h2 className="mt-2 text-[1.5rem] font-bold leading-[1.08] text-[var(--ds-color-ink)]">Veja um relatório inteiro antes de assinar.</h2>
            <p className="ds-body mt-2">Navegue pelos rankings, pelo vídeo da semana e pelas frases de abertura com dados sanitizados.</p>
            <button type="button" className="ds-button ds-button--primary mt-4" onClick={() => handleDemoChange(true)}>Ver relatório de exemplo</button>
          </section>
        ) : null}

        {isDemo ? (
          <section className="ds-editorial-panel p-5">
            <span className="ds-eyebrow">Fim do exemplo</span>
            <h2 className="mt-2 text-[1.45rem] font-bold leading-tight text-[var(--ds-color-ink)]">O seu usa os seus últimos 90 dias.</h2>
            <p className="ds-body mt-2">Depois da conexão, ele aparece aqui e se atualiza toda segunda-feira.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!isPro ? <button type="button" className="ds-button ds-button--primary ds-button--small" onClick={() => onUpgrade("narrative_map")}>Assinar</button> : null}
              <button type="button" className="ds-button ds-button--quiet ds-button--small" onClick={() => handleDemoChange(false)}>Voltar ao meu perfil</button>
            </div>
          </section>
        ) : null}

        <MeetingCard meeting={weeklyMeeting} isPro={isPro} isDemo={isDemo} onUpgrade={onUpgrade} />

        <p className="pb-2 text-center text-[11px] leading-[1.45] text-[var(--ds-color-text-muted)]">
          Segunda o relatório chega. Quinta a gente conversa sobre ele.
        </p>
      </div>
    </main>
  );
}
