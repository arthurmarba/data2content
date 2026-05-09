import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { ArrowUpRight, BarChart3, CheckCircle2, FileText, Layers3, MessageSquareText, Route, Send, ShieldCheck, Sparkles } from 'lucide-react';

import {
  buildBrandNarrativeDeckPresentation,
  buildPublicBrandNarrativeReportPresentation,
  formatBrandReportMetricCompact,
  getBrandReportEvidenceTags,
  getPublicBrandNarrativeReportBySlug,
} from '@/app/lib/brands/brandNarrativeReportBuilder';

import BrandReportActions from './BrandReportActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: {
    slug: string;
  } | Promise<{
    slug: string;
  }>;
};

type PublicEvidencePost = {
  title?: string | null;
  description?: string | null;
  postLink?: string | null;
  coverUrl?: string | null;
  postDate?: string | Date | null;
  format?: string | null;
  views?: number | null;
  totalInteractions?: number | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getLevelClass(level?: string | null) {
  if (level === 'alto') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (level === 'medio') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-[#d8dde6] bg-[#f7f8fa] text-[#667085]';
}

function firstValue(values?: string[] | null) {
  return Array.isArray(values) ? values.find((value) => value.trim()) || null : null;
}

function formatEvidenceReason(post: PublicEvidencePost, tags: string[]) {
  if (!tags.length) return null;
  const tagText = tags.join(' + ');
  const metrics: string[] = [];
  if ((post.views || 0) >= 100_000) metrics.push(`${formatBrandReportMetricCompact(post.views)} visualizações`);
  if ((post.totalInteractions || 0) >= 10_000) metrics.push(`${formatBrandReportMetricCompact(post.totalInteractions)} interações`);
  return metrics.length ? `${tagText}. Sinal orgânico com ${metrics.join(' e ')}.` : `${tagText}.`;
}

const BRAND_REPORT_PUBLIC_PAGE_DEBUG = process.env.NODE_ENV === 'development';

async function resolvePageParams(params: PageProps['params']) {
  return Promise.resolve(params);
}

function debugPublicReportPage(message: string, payload?: Record<string, unknown>) {
  if (!BRAND_REPORT_PUBLIC_PAGE_DEBUG) return;
  console.debug('[BRAND_REPORT_PUBLIC_PAGE]', message, payload || {});
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await resolvePageParams(params);
  const report = await getPublicBrandNarrativeReportBySlug(slug);
  if (!report) {
    return {
      title: 'Relatório de match narrativo | Data2Content',
      description: 'Relatório público de oportunidade narrativa.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const creatorName = report.creator?.name || 'Creator';
  const brandName = report.brand?.brandName || 'Marca';
  const deck = buildBrandNarrativeDeckPresentation(report);

  return {
    title: `${creatorName} + ${brandName} | Match narrativo`,
    description: deck.heroThesis.subtitle || 'Relatório público de oportunidade narrativa.',
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function BrandNarrativeReportPage({ params }: PageProps) {
  const { slug } = await resolvePageParams(params);
  debugPublicReportPage('buscando relatório público', { slug });
  const report = await getPublicBrandNarrativeReportBySlug(slug);
  if (!report) {
    debugPublicReportPage('notFound', {
      slug,
      reason: 'nenhum relatório active encontrado para publicSlug',
    });
    notFound();
  }
  debugPublicReportPage('relatório encontrado', { slug, status: report.status });

  const creatorName = report.creator?.name || 'Creator';
  const creatorHandle = report.creator?.handle || null;
  const brandName = report.brand?.brandName || 'Marca';
  const primaryCategory = firstValue(report.brand?.category);
  const evidencePosts = (Array.isArray(report.evidencePosts) ? report.evidencePosts : []).slice(0, 6) as PublicEvidencePost[];
  const matchedSignals = (Array.isArray(report.match?.matchedSignals) ? report.match.matchedSignals : []) as string[];
  const presentation = buildPublicBrandNarrativeReportPresentation(report);
  const deck = buildBrandNarrativeDeckPresentation(report);
  const content = presentation.content;
  const suggestedExecution = (Array.isArray(content.suggestedExecution)
    ? content.suggestedExecution
    : []) as string[];
  const narrativeFormula = Array.isArray(deck.narrativeFormulaSteps) && deck.narrativeFormulaSteps.length
    ? deck.narrativeFormulaSteps
    : Array.isArray(content.narrativeFormula)
      ? content.narrativeFormula
      : [];
  const activationPlan = Array.isArray(deck.activationTimeline) && deck.activationTimeline.length
    ? deck.activationTimeline
    : Array.isArray(content.activationPlan) && content.activationPlan.length
    ? content.activationPlan
    : suggestedExecution.map((item, index) => ({
        phase: `Etapa ${index + 1}`,
        stepLabel: index === 0 ? 'Contexto' : 'Ativação',
        title: item,
        description: 'Sugestão de ativação para manter a marca dentro da narrativa orgânica.',
        suggestedFormat: item,
        brandRole: `${brandName} pode entrar como parte da história, sem interromper a linguagem da criadora.`,
      }));
  const evidenceStoryline = Array.isArray(deck.evidenceStoryline) && deck.evidenceStoryline.length
    ? deck.evidenceStoryline
    : evidencePosts.map((post, index) => {
        const tags = getBrandReportEvidenceTags(post, matchedSignals);
        const hasViews = (post.views || 0) > 0;
        const metricHighlight = formatBrandReportMetricCompact(hasViews ? post.views : post.totalInteractions);
        return {
          role: index === 0 ? 'Conexão' : 'Prova de performance',
          title: post.title || post.description || `Evidência orgânica ${index + 1}`,
          description: post.description || 'Conteúdo orgânico selecionado como evidência de aderência narrativa.',
          reason:
            formatEvidenceReason(post, tags) ||
            'Esse conteúdo ajuda a sustentar a hipótese de que a audiência responde a esse território criativo.',
          metricHighlight,
          metricLabel: hasViews ? 'visualizações' : 'interações',
          proof: formatEvidenceReason(post, tags),
          postLink: post.postLink || null,
          coverUrl: post.coverUrl || null,
          metrics: [
            { label: 'Visualizações', value: formatBrandReportMetricCompact(post.views) },
            { label: 'Interações', value: formatBrandReportMetricCompact(post.totalInteractions) },
          ],
          tags,
        };
      });
  const brandCategories = [
    primaryCategory,
    ...(Array.isArray(report.brand?.subcategories) ? report.brand.subcategories : []),
  ].filter((value): value is string => Boolean(value && value.trim()));
  const matrixSource = Array.isArray(deck.brandMatchMatrix) ? deck.brandMatchMatrix : [];
  const matchMatrixBlocks = [
    {
      label: 'Território da marca',
      value: brandCategories.join(' / ') || matrixSource[0]?.brandRelevance || brandName,
    },
    {
      label: 'Território do creator',
      value: [report.pauta?.theme, report.pauta?.title].filter(Boolean).join(' / ') || presentation.chips.join(', ') || creatorName,
    },
    {
      label: 'Ponto de interseção',
      value: matrixSource[0]?.evidence || presentation.chips.join(', ') || content.brandFit,
    },
    {
      label: 'Forma natural de entrada',
      value: matrixSource[2]?.brandRelevance || deck.brandInsertionThesis.body || presentation.organicEntry,
    },
  ];
  const commercialBullets = Array.isArray(deck.commercialRecap.bullets) && deck.commercialRecap.bullets.length
    ? deck.commercialRecap.bullets
    : [content.commercialClose || content.organicProof].filter(Boolean);
  const approachMessage = deck.finalCta.suggestedMessage || content.creatorApproachMessage;
  const suggestedNextStep = deck.suggestedNextStep || 'Abrir uma conversa consultiva com a marca, apresentando o relatório como hipótese criativa para avaliação.';
  const approachMessageTitle = deck.approachMessageTitle || 'Mensagem sugerida para abordagem';
  const approachMessageIntro = deck.approachMessageIntro || 'Use este texto como ponto de partida para abrir uma conversa consultiva, sem assumir parceria ou campanha ativa.';
  const getProofMetric = (label: string) =>
    deck.organicSeriesProof.metrics.find((metric) => metric.label === label)?.value || '0';
  const organicProofMetrics = [
    { label: 'conteúdos', value: getProofMetric('Evidências orgânicas') },
    { label: 'visualizações', value: getProofMetric('Visualizações') },
    { label: 'interações', value: getProofMetric('Interações') },
  ];

  return (
    <main className="min-h-screen bg-[#14161c] text-[#111318]">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-white/[0.08] pb-4 text-white sm:flex-row sm:items-center sm:justify-between sm:pb-5">
          <div>
            <p className="text-sm font-bold text-white">Data2Content</p>
            <p className="mt-1 text-xs font-semibold uppercase text-white/45">
              Deck comercial compartilhável
            </p>
          </div>
          <BrandReportActions approachMessage={approachMessage} />
        </header>

        <section className="grid gap-6 py-6 text-white sm:py-10 lg:min-h-[calc(100vh-6rem)] lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
          <div className="max-w-5xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase sm:text-xs">
              <span className="inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-2.5 py-1.5 text-sky-100 sm:px-3">
                Oportunidade validada
              </span>
              <span className="inline-flex rounded-full border border-white/[0.14] bg-white/[0.06] px-2.5 py-1.5 text-white/72 sm:px-3">
                Marca observada externamente
              </span>
              {report.match?.matchLevel ? (
                <span className={cn("inline-flex rounded-full border px-3 py-1.5", getLevelClass(report.match.matchLevel))}>
                  Match {report.match.matchLevel}
                </span>
              ) : null}
            </div>

            <h1 className="mt-5 max-w-5xl text-[2.1rem] font-semibold leading-[1.04] text-white sm:mt-7 sm:text-6xl sm:leading-[1.02] lg:text-7xl">
              {deck.heroThesis.title || `${brandName} pode entrar em uma narrativa orgânica já validada por ${creatorName}.`}
            </h1>
            <p className="mt-4 max-w-3xl text-[0.95rem] font-medium leading-6 text-white/68 sm:mt-6 sm:text-xl sm:leading-8">
              {deck.heroThesis.subtitle || content.executiveSummary}
            </p>

            <div className="mt-5 flex flex-wrap gap-2 sm:mt-8">
              {presentation.chips.slice(0, 6).map((chip) => (
                <span key={chip} className="rounded-full border border-white/[0.12] bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/70">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <aside className="rounded-[32px] border border-white/[0.10] bg-[#1b1e26] p-5 text-white shadow-[0_28px_80px_rgba(0,0,0,0.16)]">
            <div className="flex items-center gap-3">
              {report.creator?.profilePictureUrl ? (
                <img
                  src={report.creator.profilePictureUrl}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover ring-1 ring-zinc-200"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-lg font-bold text-zinc-500">
                  {creatorName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{creatorName}</p>
                {creatorHandle ? <p className="mt-0.5 text-sm font-medium text-white/48">{creatorHandle}</p> : null}
              </div>
            </div>

            <div className="mt-6 border-t border-white/[0.10] pt-5">
              <p className="text-xs font-bold uppercase text-white/42">{deck.organicSeriesProof.title}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {organicProofMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-white/[0.09] bg-[#242936] px-3 py-3">
                    <p className="text-xl font-semibold leading-none text-white">{metric.value}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase text-white/38">{metric.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-white/66">
                Sinais orgânicos de resposta da audiência antes de qualquer proposta comercial.
              </p>
            </div>
          </aside>
        </section>

        <section className="-mx-4 bg-[#f4f5f7] px-4 py-10 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-3 md:grid-cols-4">
              {deck.organicSeriesProof.metrics.map((metric) => (
                <MetricHero key={metric.label} label={metric.label} value={metric.value} />
              ))}
            </div>

            <div className="mt-6 rounded-[24px] border border-[#f1d89a] bg-[#fff8e6] px-5 py-4 text-sm font-semibold leading-6 text-[#6f4e00]">
              {deck.heroThesis.disclaimer || content.disclaimer}
            </div>
          </div>

          {narrativeFormula.length ? (
            <FormulaSection title={deck.narrativeFormulaTitle} steps={narrativeFormula} />
          ) : null}

          <section className="mt-10">
            <SectionHeader
              icon={<Layers3 className="h-5 w-5" />}
              eyebrow="Evidências orgânicas"
              title="As evidências que sustentam a oportunidade"
              description="Os posts selecionados mostram resposta orgânica da audiência antes de qualquer proposta comercial, reduzindo o risco de uma entrada desconectada."
            />
            {evidenceStoryline.length ? (
              <div className="mt-7 grid gap-4 lg:grid-cols-3">
                {evidenceStoryline.map((item, index) => (
                  <EvidenceStoryCard key={item.postLink || item.title || `storyline-${index}`} item={item} index={index} />
                ))}
              </div>
            ) : (
              <div className="mt-7 rounded-[28px] border border-[#e4e7ec] bg-[#fbfbfc] px-6 py-8 text-sm font-semibold leading-6 text-zinc-600 shadow-[0_18px_50px_rgba(15,23,42,0.045)]">
                Ainda não há evidências orgânicas suficientes para consolidar essa leitura. Neste caso, a oportunidade deve ser tratada como hipótese criativa para validação.
              </div>
            )}
          </section>

          <section className="mt-12 grid gap-5 rounded-[36px] bg-[#14161c] p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] sm:p-7 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <div className="flex items-center gap-2 text-sky-200">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                <p className="text-xs font-bold uppercase">Por que essa marca combina</p>
              </div>
              <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
                O match é por história, não apenas por categoria.
              </h2>
              <p className="mt-4 text-sm font-medium leading-7 text-white/62">{content.brandFit}</p>
              {matchedSignals.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {matchedSignals.slice(0, 8).map((signal) => (
                    <span key={signal} className="rounded-full border border-white/[0.12] bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/70">
                      {signal}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {matchMatrixBlocks.map((item) => (
                <div key={item.label} className="rounded-[24px] border border-white/[0.09] bg-[#202633] p-4">
                  <p className="text-xs font-bold uppercase text-white/42">{item.label}</p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-white/82">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <div className="rounded-[32px] border border-[#e4e7ec] bg-[#fbfbfc] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.045)]">
              <div className="flex items-center gap-2 text-sky-700">
                <FileText className="h-5 w-5" aria-hidden="true" />
                <p className="text-xs font-bold uppercase">Papel da marca</p>
              </div>
              <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#111318]">{deck.brandInsertionThesis.title}</h2>
              <p className="mt-4 text-base font-medium leading-8 text-zinc-700">{deck.brandInsertionThesis.body}</p>
            </div>
            <div className="rounded-[32px] border border-[#f1d89a] bg-[#fff8e6] p-6">
              <p className="text-xs font-bold uppercase text-amber-700">Guardrail comercial</p>
              <p className="mt-4 text-sm font-semibold leading-7 text-amber-950">{deck.brandInsertionThesis.guardrail}</p>
            </div>
          </section>

          <section className="mt-12">
            <SectionHeader
              icon={<Route className="h-5 w-5" />}
              eyebrow="Plano de ativação"
              title="Como a marca pode entrar na história"
              description="Uma sequência para transformar o match em conversa de campanha, sem quebrar a linguagem orgânica da criadora."
            />
            <div className="mt-7 grid gap-3 lg:grid-cols-5">
              {activationPlan.map((item, index) => (
                <TimelineCard key={`${item.title}-${index}`} item={item} index={index} />
              ))}
            </div>
          </section>

          <section className="mt-12 overflow-hidden rounded-[38px] bg-[#14161c] text-white shadow-[0_34px_90px_rgba(15,23,42,0.16)]">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-xs font-bold uppercase text-sky-100">
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {deck.finalCta.title}
                </div>
                <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight sm:text-5xl">
                  {deck.commercialRecap.title}
                </h2>
                <p className="mt-5 max-w-xl text-base font-medium leading-8 text-white/68">
                  {deck.finalCta.body}
                </p>
                <div className="mt-7 rounded-[28px] border border-white/[0.09] bg-[#242936] p-5">
                  <p className="text-xs font-bold uppercase text-white/42">Caminho sugerido</p>
                  <p className="mt-3 text-sm font-semibold leading-7 text-white/80">{suggestedNextStep}</p>
                </div>
                <ul className="mt-7 space-y-4">
                  {commercialBullets.map((bullet, index) => (
                    <li key={`${bullet}-${index}`} className="flex gap-3 text-sm font-medium leading-7 text-white/70">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-white/[0.10] bg-[#1b1e26] p-5 text-white sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
                <div className="flex items-center gap-2 text-sky-200">
                  <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                  <p className="text-xs font-bold uppercase">{approachMessageTitle}</p>
                </div>
                <h3 className="mt-4 text-2xl font-semibold leading-tight text-white">
                  Um texto curto para abrir a conversa.
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 text-white/58 sm:leading-7">{approachMessageIntro}</p>
                <div className="mt-6 rounded-[28px] border border-white/[0.09] bg-[#242936] p-4 sm:p-5">
                  <p className="text-[13px] font-medium leading-6 text-white/82 sm:text-sm sm:leading-7">{approachMessage}</p>
                </div>
                <div className="mt-6">
                  <BrandReportActions approachMessage={approachMessage} size="large" />
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-8 border-t border-[#e4e7ec] py-6 text-xs font-medium leading-5 text-zinc-500">
            {deck.commercialRecap.disclaimer || content.disclaimer}
          </footer>
        </section>
      </div>
    </main>
  );
}

function FormulaSection({ title, steps }: { title: string; steps: Array<{ title: string; description: string }> }) {
  return (
    <section className="mt-10 rounded-[36px] border border-[#e4e7ec] bg-[#fbfbfc] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.055)] sm:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sky-600">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <p className="text-xs font-bold uppercase">Fórmula de campanha</p>
          </div>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#111318]">{title}</h2>
        </div>
        <p className="max-w-sm text-sm font-medium leading-6 text-zinc-500">
          Três movimentos para transformar a pauta em uma entrada natural da marca.
        </p>
      </div>
      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={`${step.title}-${index}`} className="rounded-[26px] border border-[#e4e7ec] bg-[#f4f5f7] p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202633] text-sm font-bold text-white">
              {index + 1}
            </div>
            <h3 className="mt-4 text-base font-bold text-[#111318]">{step.title}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricHero({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-[#e4e7ec] bg-[#fbfbfc] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.045)]">
      <p className="text-xs font-bold uppercase text-zinc-400">{label}</p>
      <p className="mt-3 text-4xl font-semibold leading-none text-[#111318] sm:text-5xl">{value}</p>
    </div>
  );
}

type StorylineItem = {
  role: string;
  title: string;
  description: string;
  reason: string;
  metricHighlight: string;
  metricLabel: string;
  proof: string | null;
  postLink: string | null;
  coverUrl: string | null;
  metrics: Array<{ label: string; value: string }>;
  tags: string[];
};

function EvidenceStoryCard({ item, index }: { item: StorylineItem; index: number }) {
  const primaryMetric = item.metricHighlight !== '0'
    ? { label: item.metricLabel, value: item.metricHighlight }
    : item.metrics.find((metric) => metric.value !== '0') || item.metrics[0] || null;

  return (
    <article className="overflow-hidden rounded-[32px] border border-[#e4e7ec] bg-[#fbfbfc] shadow-[0_22px_60px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase text-zinc-400">Etapa {index + 1}</p>
          <p className="mt-1 text-lg font-semibold leading-none text-[#111318]">{item.role}</p>
        </div>
        {primaryMetric ? (
          <div className="rounded-2xl bg-[#202633] px-3.5 py-2.5 text-right text-white">
            <p className="text-xl font-semibold leading-none">{primaryMetric.value}</p>
            <p className="mt-1 text-[10px] font-bold uppercase text-white/45">{primaryMetric.label}</p>
          </div>
        ) : null}
      </div>
      {item.coverUrl ? (
        <img src={item.coverUrl} alt="" className="aspect-[16/10] w-full bg-zinc-100 object-cover" />
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-zinc-100 text-zinc-400">
          <BarChart3 className="h-9 w-9" aria-hidden="true" />
        </div>
      )}
      <div className="p-5">
        <h3 className="text-base font-bold leading-6 text-[#111318]">{item.title}</h3>
        {item.tags.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-4 text-sm font-semibold leading-6 text-zinc-700">{item.reason}</p>
        {item.proof ? (
          <p className="mt-4 rounded-[18px] border border-[#edf0f4] bg-white px-3 py-2 text-xs font-semibold leading-5 text-zinc-500">
            {item.proof}
          </p>
        ) : null}
        {item.postLink ? (
          <a
            href={item.postLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 hover:text-sky-800"
          >
            Ver post
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sky-700">
        {icon}
        <p className="text-xs font-bold uppercase">{eyebrow}</p>
      </div>
      <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-[#111318] sm:text-4xl">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

function TimelineCard({
  item,
  index,
}: {
  item: {
    phase?: string;
    stepLabel?: string;
    title: string;
    description?: string;
    suggestedFormat?: string;
    brandRole?: string;
  };
  index: number;
}) {
  return (
    <article className="relative flex min-h-0 flex-col rounded-[28px] border border-[#e4e7ec] bg-[#fbfbfc] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.045)] lg:min-h-[18rem]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase text-zinc-400">{item.phase || `Etapa ${index + 1}`}</p>
          <p className="mt-1 text-sm font-bold text-sky-700">{item.stepLabel || 'Ativação'}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#202633] text-sm font-bold text-white">
          {index + 1}
        </span>
      </div>
      <h3 className="mt-5 text-lg font-bold leading-6 text-[#111318]">{item.title}</h3>
      {item.description ? <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">{item.description}</p> : null}
      {item.suggestedFormat ? (
        <div className="mt-4">
          <span className="inline-flex rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700">
            {item.suggestedFormat}
          </span>
        </div>
      ) : null}
      {item.brandRole ? (
        <p className="mt-5 text-xs font-semibold leading-5 text-zinc-500 lg:mt-auto lg:pt-5">
          <span className="font-bold text-zinc-700">Papel da marca: </span>
          {item.brandRole}
        </p>
      ) : null}
    </article>
  );
}
