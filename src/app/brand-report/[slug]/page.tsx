import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { ArrowUpRight, BarChart3, FileText, ShieldCheck, Sparkles } from 'lucide-react';

import {
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

function formatDate(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function getLevelClass(level?: string | null) {
  if (level === 'alto') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (level === 'medio') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-zinc-200 bg-zinc-50 text-zinc-600';
}

function firstValue(values?: string[] | null) {
  return Array.isArray(values) ? values.find((value) => value.trim()) || null : null;
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
  const presentation = buildPublicBrandNarrativeReportPresentation(report);

  return {
    title: `${creatorName} + ${brandName} | Match narrativo`,
    description: presentation.content.executiveSummary || 'Relatório público de oportunidade narrativa.',
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
  const content = presentation.content;
  const suggestedExecution = (Array.isArray(content.suggestedExecution)
    ? content.suggestedExecution
    : []) as string[];

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold tracking-[-0.02em] text-zinc-950">Data2Content</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Relatório compartilhável
            </p>
          </div>
          <BrandReportActions approachMessage={content.creatorApproachMessage} />
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-sky-700">
                Possível match narrativo
              </span>
              <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600">
                Marca observada externamente
              </span>
              {report.match?.matchLevel ? (
                <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]", getLevelClass(report.match.matchLevel))}>
                  Match {report.match.matchLevel}
                </span>
              ) : null}
            </div>

            <h1 className="mt-6 max-w-4xl text-[2.7rem] font-semibold leading-[0.95] tracking-[-0.07em] text-zinc-950 sm:text-[4.5rem]">
              {creatorName} + {brandName}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-600 sm:text-lg">
              {content.executiveSummary}
            </p>
          </div>

          <aside className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
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
                <p className="truncate text-sm font-bold text-zinc-950">{creatorName}</p>
                {creatorHandle ? <p className="mt-0.5 text-sm font-medium text-zinc-500">{creatorHandle}</p> : null}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MetricPill label="Base analisada" value={presentation.metrics.postsAnalyzed} />
              <MetricPill label="Posts selecionados" value={presentation.metrics.evidenceCount} />
              <MetricPill label="Visualizações" value={presentation.metrics.totalViews} />
              <MetricPill label="Interações" value={presentation.metrics.totalInteractions} />
            </div>
          </aside>
        </section>

        <section className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium leading-6 text-amber-900">
          {content.disclaimer}
        </section>

        <div className="grid gap-5 py-8">
          <ReportSection
            icon={<Sparkles className="h-5 w-5" />}
            title="Tese da oportunidade"
            body={content.narrativeThesis}
            aside={
              <div className="space-y-2">
                {report.pauta?.title ? <InfoLine label="Pauta" value={report.pauta.title} /> : null}
                {report.pauta?.theme ? <InfoLine label="Tema" value={report.pauta.theme} /> : null}
                {presentation.chips.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {presentation.chips.map((chip) => (
                      <span key={chip} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500">
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            }
          />
          <ReportSection
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Por que essa narrativa combina com a marca"
            body={content.brandFit}
            aside={
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Marca</p>
                <p className="mt-1 text-lg font-bold text-zinc-950">{brandName}</p>
                {primaryCategory ? <p className="mt-1 text-sm font-semibold text-zinc-500">{primaryCategory}</p> : null}
                {matchedSignals.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {matchedSignals.slice(0, 8).map((signal) => (
                      <span key={signal} className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                        {signal}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            }
          />
        </div>

        <section className="py-4">
          <SectionHeader
            eyebrow="Evidências"
            title="Prova orgânica"
            description={content.organicProof}
          />
          {evidencePosts.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {evidencePosts.map((post, index) => (
                <article key={post.postLink || post.title || post.description || `evidence-${index}`} className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_16px_46px_rgba(15,23,42,0.05)]">
                  {post.coverUrl ? (
                    <img src={post.coverUrl} alt="" className="aspect-[16/10] w-full bg-zinc-100 object-cover" />
                  ) : (
                    <div className="flex aspect-[16/10] w-full items-center justify-center bg-zinc-100 text-zinc-400">
                      <BarChart3 className="h-8 w-8" aria-hidden="true" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-400">
                      {post.format ? <span>{post.format}</span> : null}
                      {formatDate(post.postDate) ? <span>{formatDate(post.postDate)}</span> : null}
                    </div>
                    {getBrandReportEvidenceTags(post, matchedSignals).length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {getBrandReportEvidenceTags(post, matchedSignals).map((tag) => (
                          <span key={tag} className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-zinc-800">
                      {post.title || post.description || 'Conteúdo orgânico'}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <MetricPill label="Visualizações" value={formatBrandReportMetricCompact(post.views)} compact />
                      <MetricPill label="Interações" value={formatBrandReportMetricCompact(post.totalInteractions)} compact />
                    </div>
                    {post.postLink ? (
                      <a
                        href={post.postLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 hover:text-sky-800"
                      >
                        Ver post
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] border border-zinc-200 bg-white px-5 py-5 text-sm font-medium leading-6 text-zinc-600">
              Este relatório foi gerado com base na pauta selecionada e no encaixe narrativo da marca. Ainda não há volume suficiente de posts orgânicos relacionados para consolidar prova quantitativa específica dessa narrativa.
            </div>
          )}
        </section>

        <div className="grid gap-5 py-8">
          <ReportSection
            icon={<Sparkles className="h-5 w-5" />}
            title="Ideia de campanha"
            body={content.campaignIdea}
          />
          <ReportSection
            icon={<FileText className="h-5 w-5" />}
            title="Como a marca pode entrar organicamente"
            body={presentation.organicEntry}
          />
        </div>

        <section className="grid gap-5 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_16px_46px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Entregáveis sugeridos</p>
            <ul className="mt-4 space-y-3">
              {suggestedExecution.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm font-semibold leading-6 text-zinc-700">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-zinc-950 p-5 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Mensagem sugerida para abordagem</p>
            <p className="mt-4 text-base font-medium leading-8 text-white/86">{content.creatorApproachMessage}</p>
          </div>
        </section>

        <footer className="border-t border-zinc-200 py-6 text-xs font-medium leading-5 text-zinc-500">
          {content.disclaimer}
        </footer>
      </div>
    </main>
  );
}

function MetricPill({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-[18px] bg-zinc-50", compact ? "px-3 py-2" : "px-3.5 py-3")}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className={cn("font-bold tracking-[-0.03em] text-zinc-950", compact ? "mt-1 text-sm" : "mt-1.5 text-lg")}>
        {value}
      </p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-zinc-700">{value}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.055em] text-zinc-950">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-zinc-600">{description}</p>
    </div>
  );
}

function ReportSection({
  icon,
  title,
  body,
  aside,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  aside?: ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_16px_46px_rgba(15,23,42,0.05)] lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        <div className="flex items-center gap-2 text-sky-600">
          {icon}
          <p className="text-xs font-bold uppercase tracking-[0.16em]">{title}</p>
        </div>
        <p className="mt-4 text-base font-medium leading-8 text-zinc-700">{body}</p>
      </div>
      {aside ? <aside className="rounded-[22px] bg-zinc-50 p-4">{aside}</aside> : null}
    </section>
  );
}
