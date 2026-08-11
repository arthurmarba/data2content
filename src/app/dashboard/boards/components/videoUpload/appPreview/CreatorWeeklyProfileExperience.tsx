"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, Calculator } from "lucide-react";
import Link from "next/link";
import { COMMUNITY_WHATSAPP_URL } from "@/app/lib/communityLinks";
import { RECORDED_MEETINGS_ROUTE } from "@/constants/routes";
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
    <div className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ds-color-neutral)] text-[24px] font-extrabold text-[var(--ds-color-ink)]">
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
      <section className="ds-notebook-section">
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

  return (
    <section className="ds-notebook-section">
      {/* A contagem diz que o caminho é curto e finito — "Próximos passos" não diz. */}
      <span className="ds-notebook-label">{proNeedsInstagram ? "Falta 1 passo" : "Faltam 2 passos"}</span>
      <h2 className="mt-3 text-[1.5rem] font-bold leading-[1.08] text-[var(--ds-color-ink)]">
        Você já contou quem você é. Agora falta a D2C ver os seus vídeos.
      </h2>
      <p className="ds-body mt-3">Dia, horário, cena e assunto são calculados com os seus próprios posts.</p>

      <ol className="mt-5 space-y-5">
        <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
          <span className={`pt-0.5 text-[13px] font-bold ${proNeedsInstagram ? "text-[var(--ds-color-text-muted)]" : "text-[var(--ds-color-ink)]"}`}>
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
        <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
          <span className={`pt-0.5 text-[13px] font-bold ${proNeedsInstagram ? "text-[var(--ds-color-ink)]" : "text-[var(--ds-color-text-muted)]"}`}>2</span>
          <div>
            <p className="m-0 text-[14px] font-bold text-[var(--ds-color-ink)]">Conectar o seu Instagram</p>
            <p className="ds-caption mt-1">Você autoriza pelo próprio Instagram e pode desconectar quando quiser.</p>
            {proNeedsInstagram ? (
              <button type="button" className="ds-button ds-button--primary ds-button--small mt-3" onClick={onConnectInstagram}>Conectar Instagram</button>
            ) : null}
          </div>
        </li>
      </ol>

      <div className="ds-notebook-note mt-1">
        <strong className="text-[var(--ds-color-ink)]">Sem uma fila depois da conexão.</strong> O relatório-base usa os posts já publicados; leituras visuais entram conforme ficam confiáveis.
      </div>
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
  onOpenSettings,
  onOpenAccountMenu,
}: {
  userName: string | null;
  userImageUrl: string | null;
  headerSubtitle: string;
  narrative: string;
  narrativeIsPlaceholder: boolean;
  territories: string[];
  observedSubjects: string[];
  hasVideoEvidence: boolean;
  onOpenSettings: () => void;
  onOpenAccountMenu: () => void;
}) {
  const observedNormalized = observedSubjects.map(normalizeForMatch);
  return (
    // Identidade e mapa no mesmo cartão: são a mesma pergunta — quem é você.
    // Separados por uma fronteira de cartão, o retrato virava enfeite de topo.
    <section className="ds-notebook-section ds-notebook-section--first" aria-labelledby="creator-map-title">
      <div className="flex items-center gap-4">
        <ProfileAvatar name={userName} imageUrl={userImageUrl} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.3rem] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ds-color-ink)]">
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
      <div className="mt-5">
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
        <button type="button" className="ds-notebook-action mt-2" onClick={onOpenSettings}>
          <span>Ajustar mapa</span>
          <span className="text-[var(--ds-color-text-muted)]"><ChevronIcon /></span>
        </button>
      </div>
    </section>
  );
}

function WeeklyVideoCard({ video, isDemo }: { video: CreatorWeeklyReportVideo; isDemo: boolean }) {
  const body = (
    <div className="ds-notebook-media">
      {/* Sem capa o bloco não precisa ocupar a altura de um vídeo — vira uma
          faixa baixa, para não abrir um vazio de 400px no meio da leitura. */}
      {!isDemo && video.thumbnailUrl ? (
        <div className="relative aspect-[16/10] bg-[var(--ds-color-ink)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt="Capa do vídeo da semana" className="h-full w-full object-cover opacity-85" />
        </div>
      ) : (
        <div className="grid h-[76px] place-items-center bg-[var(--ds-color-neutral)] text-center text-[12px] font-semibold text-[var(--ds-color-text-muted)]">
          {isDemo ? "Vídeo ocultado no exemplo" : "Capa indisponível"}
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span className="ds-notebook-label">Vídeo da semana</span>
          {isDemo ? <span className="ds-badge ds-badge--neutral">Exemplo</span> : null}
        </div>
        {/* O veredito vem antes da manchete: é o que a pessoa veio saber. */}
        {formatIndex(video.performanceIndex) ? (
          <p className="mt-2 text-[1.5rem] font-extrabold leading-none tracking-[-0.02em] text-[var(--ds-color-success)]">{formatIndex(video.performanceIndex)}</p>
        ) : null}
        <h2 className="mt-2 text-[1.35rem] font-bold leading-[1.12] text-[var(--ds-color-ink)]">{video.description}</h2>
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
  onOpenDetail,
}: {
  report: CreatorWeeklyReportPayload;
  isDemo: boolean;
  onOpenDetail: (id: CreatorWeeklyReportDetailId) => void;
}) {
  return (
    <section aria-labelledby="weekly-report-title" className="ds-notebook-section">
      <div className="flex items-center gap-2">
        <span className="ds-notebook-label">Seu relatório</span>
        {isDemo ? <span className="ds-badge ds-badge--neutral">Exemplo</span> : null}
      </div>
      <h2 id="weekly-report-title" className="mt-2 text-[1.75rem] font-bold leading-none tracking-[-0.025em] text-[var(--ds-color-ink)]">A semana por dentro</h2>
      {/* "90 dias" colado no título contradizia a seção, que fala da semana.
          Como linha de apoio ele explica a régua em vez de confundir. */}
      <p className="ds-body mt-3">{report.overview.summary}</p>
      <p className="ds-caption mt-2">Tudo comparado com a sua mediana dos últimos 90 dias.</p>

      <div className="mt-5 grid grid-cols-3 py-2">
        {report.overview.numbers.map((number) => (
          <div key={number.label} className="border-r border-[var(--ds-color-line)] px-2 text-center first:pl-0 last:border-r-0 last:pr-0">
            <b className="block text-[1.25rem] leading-none text-[var(--ds-color-ink)]">{number.value}</b>
            <span className="mt-1 block text-[10px] leading-[1.2] text-[var(--ds-color-text-muted)]">{number.label}</span>
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
              <span className="mt-1 block text-[11px] leading-[1.35] text-[var(--ds-color-text-muted)]">{detail.summary}</span>
            </span>
            <span className="text-[var(--ds-color-text-muted)]"><ChevronIcon /></span>
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
    <section className="ds-notebook-section">
      <span className="ds-notebook-label">O que chega toda segunda</span>
      <h2 className="mt-3 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">Depois dos dois passos</h2>
      {/* Sem cadeado por linha: o título já diz que isso ainda vai chegar, e um
          ícone de 12px repetido quatro vezes só adiciona ruído. */}
      <div className="ds-notebook-divided mt-4">
        {rows.map(([title, subtitle]) => (
          <div key={title} className="py-3">
            <b className="block text-[14px] text-[var(--ds-color-ink)]">{title}</b>
            <span className="ds-caption mt-1 block">{subtitle}</span>
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
    <section className="ds-notebook-section">
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
    <section className="ds-notebook-section">
      <span className="ds-notebook-label">Reunião da comunidade</span>
      <h2 className="mt-2 text-[1.4rem] font-bold leading-tight text-[var(--ds-color-ink)]">
        {cancelled ? "Esta edição foi cancelada" : meeting ? formatMeetingDate(meeting) : "Toda quinta, 19h"}
      </h2>
      {/* A segunda frase existe para explicar o botão: é no grupo que se
          confirma presença, e quem confirma é analisado. Sem ela, "entrar no
          grupo" é só um grupo. */}
      <p className="ds-body mt-2">
        Toda semana a D2C comenta o relatório de quem confirmou presença e responde dúvidas sobre estratégia de conteúdo.
        A confirmação é feita dentro do grupo do WhatsApp.{" "}
        {isPro && !isDemo
          ? "Se não der para assistir ao vivo, fica gravado."
          : "Assinantes entram no grupo, participam ao vivo e reveem as gravações."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {isPro && !isDemo ? (
          <>
            <a
              href={COMMUNITY_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="ds-button ds-button--secondary ds-button--small no-underline"
            >
              Entrar no grupo
            </a>
            {/* Secundário de propósito: entrar no grupo é semanal, rever gravação
                é eventual. */}
            <Link href={RECORDED_MEETINGS_ROUTE} className="ds-button ds-button--quiet ds-button--small no-underline">
              Ver gravações
            </Link>
          </>
        ) : (
          <button type="button" className="ds-button ds-button--quiet ds-button--small" onClick={() => onUpgrade("mentoria")}>
            Ser membro e entrar no grupo
          </button>
        )}
      </div>
    </section>
  );
}

export function CreatorWeeklyProfileExperience({
  data,
  weeklyMeeting,
  calculatorPrice = null,
  isDemo,
  onDemoChange,
  onOpenAccountMenu,
  onOpenNorte,
  onOpenMediaKit,
  onOpenCalculator,
  onUpgrade,
  onConnectInstagram,
}: {
  data: DiagnosticoPageData;
  weeklyMeeting: WeeklyMeetingProfileData | null;
  /** Último cálculo de publi já formatado (ex.: "R$ 2.800"), quando existir. */
  calculatorPrice?: string | null;
  isDemo: boolean;
  onDemoChange: (demo: boolean) => void;
  onOpenAccountMenu: () => void;
  onOpenNorte: () => void;
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

  const declaredNarrative = data.mapaSeed?.narrativa_central?.trim()
    || data.synthesis.mainNarrative?.label?.trim()
    || "";
  const narrativeIsPlaceholder = declaredNarrative.length === 0;
  const narrative = narrativeIsPlaceholder
    ? "Sua história ainda está ganhando forma. Responda o Seu Norte para escrevê-la."
    : declaredNarrative;
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
    <main className="ds-notebook-page ds-analysis-editorial">
      <div>
        {/* Identidade sempre primeiro: em qualquer estado ela abre o app e vê
            o próprio perfil antes de qualquer cobrança ou relatório. */}
        <CreatorMap
          userName={data.userInfo.name}
          userImageUrl={data.userInfo.imageUrl}
          headerSubtitle={isDemo ? "Relatório de exemplo" : report ? `Semana de ${report.period.rangeLabel}` : `Olá, ${firstName(data.userInfo.name)}`}
          narrative={narrative}
          narrativeIsPlaceholder={narrativeIsPlaceholder}
          territories={territories}
          observedSubjects={report?.overview.observedSubjects ?? []}
          hasVideoEvidence={(report?.coverage.postsWithScene ?? 0) > 0 && !isDemo}
          onOpenSettings={onOpenNorte}
          onOpenAccountMenu={onOpenAccountMenu}
        />

        {/* Depois da identidade, a ordem muda com o estado: quem já tem relatório
            abre o app para ver a semana, então as ferramentas descem para o fim.
            Quem ainda não tem vê nelas o valor que a assinatura libera. */}
        {!hasReportAccess && !isDemo ? (
          <ActivationCard accessState={data.accessState} onUpgrade={onUpgrade} onConnectInstagram={onConnectInstagram} />
        ) : null}

        {!hasReportAccess || isDemo ? (
          <UtilityPanel isPro={isPro && !isDemo} calculatorPrice={calculatorPrice} onOpenMediaKit={isDemo ? () => onUpgrade("media_kit") : onOpenMediaKit} onOpenCalculator={isDemo ? () => onUpgrade("calculator") : onOpenCalculator} />
        ) : null}

        {isDemo ? (
          <section className="ds-notebook-section">
            <p className="ds-notebook-note">
            <strong>Você está vendo um exemplo.</strong> Seu nome, sua foto e seu mapa continuam sendo seus; só os números abaixo são demonstrativos.
            </p>
          </section>
        ) : null}

        {report && (hasReportAccess || isDemo) ? (
          <ReportOverview report={report} isDemo={isDemo} onOpenDetail={handleOpenDetail} />
        ) : hasReportAccess ? (
          <section className="ds-notebook-section" role="status" aria-live="polite">
            <span className="ds-notebook-label">Seu relatório</span>
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
          <section className="ds-notebook-section">
            <span className="ds-notebook-label">Veja por dentro</span>
            <h2 className="mt-2 text-[1.5rem] font-bold leading-[1.08] text-[var(--ds-color-ink)]">Veja um relatório inteiro antes de assinar.</h2>
            <p className="ds-body mt-2">Navegue pelos rankings, pelo vídeo da semana e pelas frases de abertura com dados sanitizados.</p>
            {/* Secundário de propósito: o vermelho da tela pertence a "Assinar".
                Dois botões cheios na mesma rolagem anulam um ao outro. */}
            <button type="button" className="ds-button ds-button--secondary mt-4" onClick={() => handleDemoChange(true)}>Ver relatório de exemplo</button>
          </section>
        ) : null}

        {isDemo ? (
          <section className="ds-notebook-section">
            <span className="ds-notebook-label">Fim do exemplo</span>
            <h2 className="mt-2 text-[1.45rem] font-bold leading-tight text-[var(--ds-color-ink)]">O seu usa os seus últimos 90 dias.</h2>
            <p className="ds-body mt-2">Depois da conexão, ele aparece aqui e se atualiza toda segunda-feira.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!isPro ? <button type="button" className="ds-button ds-button--primary ds-button--small" onClick={() => onUpgrade("narrative_map")}>Assinar</button> : null}
              <button type="button" className="ds-button ds-button--quiet ds-button--small" onClick={() => handleDemoChange(false)}>Voltar ao meu perfil</button>
            </div>
          </section>
        ) : null}

        <MeetingCard meeting={weeklyMeeting} isPro={isPro} isDemo={isDemo} onUpgrade={onUpgrade} />

        {hasReportAccess && !isDemo ? (
          <UtilityPanel isPro={isPro} calculatorPrice={calculatorPrice} onOpenMediaKit={onOpenMediaKit} onOpenCalculator={onOpenCalculator} />
        ) : null}

        <p className="pb-2 pt-6 text-center text-[11px] leading-[1.45] text-[var(--ds-color-text-muted)]">
          Segunda o relatório chega. Quinta a gente conversa sobre ele.
        </p>
      </div>
    </main>
  );
}
