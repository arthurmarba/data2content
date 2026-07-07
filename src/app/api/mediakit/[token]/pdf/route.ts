import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readdirSync } from 'fs';

import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import User from '@/app/models/User';
import PubliCalculation from '@/app/models/PubliCalculation';
import MediaKitPackage from '@/app/models/MediaKitPackage';
import MediaKitPdfCache from '@/app/models/MediaKitPdfCache';
import rateLimit from '@/utils/rateLimit';
import { getClientIp } from '@/utils/getClientIp';
import { resolveMediaKitToken } from '@/app/lib/mediakit/slugService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CACHE_TTL_MS = 30 * 60 * 1000;
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  keyPrefix: 'media_kit_pdf',
});

const resolveAppOrigin = (req: NextRequest) => {
  const envOrigin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').trim();
  const host = req.headers.get('host') || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

  // No ambiente local, priorizamos a URL do request para garantir que o Playwright
  // acesse a instância correta (ex: localhost:3000 em vez de produção).
  if (isLocal) {
    return req.nextUrl.origin.replace(/\/$/, '');
  }

  if (envOrigin) return envOrigin.replace(/\/$/, '');
  return req.nextUrl.origin.replace(/\/$/, '');
};

const buildCacheKey = (token: string, parts: Array<string | null | undefined>) => {
  const seed = [token, ...parts.filter(Boolean)].join('|');
  return crypto.createHash('sha1').update(seed).digest('hex').slice(0, 18);
};

const getCacheFilePath = (key: string) => {
  const cacheDir = path.join(os.tmpdir(), 'd2c-mediakit-pdf');
  return { cacheDir, cacheFile: path.join(cacheDir, `${key}.pdf`) };
};

const CACHE_BACKEND = (process.env.MEDIA_KIT_PDF_CACHE || 'mongo').toLowerCase();
const PDF_CACHE_VERSION = 'visual-html-v4';
const resolvePdfRenderer = () => {
  const configured = (process.env.MEDIA_KIT_PDF_RENDERER || '').trim().toLowerCase();
  if (configured === 'browser' || configured === 'browser-page' || configured === 'visual' || configured === 'direct') {
    return configured;
  }
  return shouldUseServerlessChromium() ? 'visual' : 'browser-page';
};

type MediaKitPdfUser = {
  _id?: unknown;
  name?: string | null;
  mediaKitDisplayName?: string | null;
  username?: string | null;
  biography?: string | null;
  followers_count?: number | null;
  media_count?: number | null;
  mediaKitSlug?: string | null;
  mediaKitPricingPublished?: boolean | null;
};

type MediaKitPdfPackage = {
  name?: string | null;
  price?: number | null;
  currency?: string | null;
  deliverables?: string[] | null;
  description?: string | null;
};

type MediaKitPdfPricing = {
  result?: {
    estrategico?: number | null;
    justo?: number | null;
    premium?: number | null;
  } | null;
  metrics?: {
    reach?: number | null;
    engagement?: number | null;
  } | null;
  cpmApplied?: number | null;
  createdAt?: Date | string | null;
} | null;

type MediaKitPdfTopPost = {
  _id?: string | null;
  caption?: string | null;
  description?: string | null;
  postDate?: string | Date | null;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
  coverUrl?: string | null;
  cover_url?: string | null;
  previewImageUrl?: string | null;
  preview_image_url?: string | null;
  stats?: {
    views?: number | null;
    reach?: number | null;
    likes?: number | null;
    comments?: number | null;
  } | null;
  derivedStats?: {
    views?: number | null;
    engagementRate?: number | null;
  } | null;
};

type MediaKitPdfDemographics = {
  follower_demographics?: {
    gender?: Record<string, number>;
    age?: Record<string, number>;
    city?: Record<string, number>;
    country?: Record<string, number>;
  };
  engaged_audience_demographics?: {
    gender?: Record<string, number>;
    age?: Record<string, number>;
    city?: Record<string, number>;
    country?: Record<string, number>;
  };
} | null;

const DEFAULT_CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-default-apps',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--disable-translate',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
  '--js-flags=--max-old-space-size=128',
];
type ChromiumLaunchAttempt = {
  label: string;
  executablePath?: string;
  args?: string[];
};

const resolveChromiumArgs = () => {
  const extraArgs = (process.env.PLAYWRIGHT_EXTRA_ARGS || '')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_CHROMIUM_ARGS, ...extraArgs]));
};

const hasInstalledLocalChromium = (localBrowserPath: string) => {
  if (!existsSync(localBrowserPath)) return false;
  try {
    const entries = readdirSync(localBrowserPath, { withFileTypes: true });
    return entries.some((entry) => entry.isDirectory() && entry.name.startsWith('chromium'));
  } catch {
    return false;
  }
};

const ensureLocalPlaywrightBrowsersPath = () => {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return;
  const localBrowserPath = path.join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers');
  if (hasInstalledLocalChromium(localBrowserPath)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
  }
};

const resolveExecutableCandidates = () => {
  const envCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_BIN,
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
  ];

  const platformCandidates =
    process.platform === 'linux'
      ? [
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ]
        : [];

  return Array.from(
    new Set(
      [...envCandidates, ...platformCandidates]
        .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
        .filter(Boolean)
    )
  ).filter((candidate) => existsSync(candidate));
};

const shouldUseServerlessChromium = () =>
  process.platform === 'linux' &&
  Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.MEDIA_KIT_PDF_USE_SERVERLESS_CHROMIUM === '1'
  );

const resolveServerlessChromiumAttempt = async (baseArgs: string[]): Promise<ChromiumLaunchAttempt | null> => {
  if (!shouldUseServerlessChromium()) return null;

  try {
    const chromiumModule = await import('@sparticuz/chromium');
    const serverlessChromium = chromiumModule.default;
    const executablePath = await serverlessChromium.executablePath();
    const args = Array.from(new Set([...serverlessChromium.args, ...baseArgs]));

    return {
      label: 'serverless-chromium',
      executablePath,
      args,
    };
  } catch (error) {
    logger.warn(
      `[media-kit-pdf] Falha ao preparar Chromium serverless: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
};

const isMissingBrowserBinaryError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes("Executable doesn't exist") ||
    message.includes('download new browsers') ||
    message.includes('Please run the following command to download new browsers')
  );
};

const readCachedPdf = async (cacheKey: string, cacheFile: string) => {
  if (CACHE_BACKEND === 'mongo') {
    try {
      const record = await MediaKitPdfCache.findOne({ cacheKey, expiresAt: { $gt: new Date() } })
        .select('data contentType')
        .lean();
      if (record?.data) {
        const buffer = normalizeCachedPdfBuffer(record.data);
        if (buffer?.byteLength) {
          return { buffer, contentType: record.contentType || 'application/pdf' };
        }
        logger.warn('[media-kit-pdf] Cache Mongo encontrado, mas sem bytes válidos. Regenerando PDF.');
      }
    } catch (error) {
      logger.warn('[media-kit-pdf] Falha ao ler cache Mongo, fallback local', error as Error);
    }
  }
  if (!existsSync(cacheFile)) return null;
  try {
    const stat = await fs.stat(cacheFile);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    return { buffer: await fs.readFile(cacheFile), contentType: 'application/pdf' };
  } catch {
    return null;
  }
};

const writeCachedPdf = async (cacheKey: string, cacheDir: string, cacheFile: string, buffer: Buffer) => {
  if (CACHE_BACKEND === 'mongo') {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
      await MediaKitPdfCache.findOneAndUpdate(
        { cacheKey },
        {
          cacheKey,
          contentType: 'application/pdf',
          data: buffer,
          size: buffer.byteLength,
          expiresAt,
        },
        { upsert: true, new: true }
      );
      return;
    } catch (error) {
      logger.warn('[media-kit-pdf] Falha ao escrever cache Mongo, fallback local', error as Error);
    }
  }
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cacheFile, buffer);
  } catch (error) {
    logger.warn('[media-kit-pdf] Falha ao escrever cache', error as Error);
  }
};

const toPdfResponse = (buffer: Buffer, filename: string) => {
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  });
  const body = new Uint8Array(buffer);
  return new NextResponse(body, { status: 200, headers });
};

const normalizeCachedPdfBuffer = (value: unknown): Buffer | null => {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);

  const maybeBuffer = value as
    | {
        buffer?: unknown;
        value?: unknown;
        data?: unknown;
      }
    | null
    | undefined;

  if (!maybeBuffer || typeof maybeBuffer !== 'object') return null;

  if (Buffer.isBuffer(maybeBuffer.buffer)) return maybeBuffer.buffer;
  if (maybeBuffer.buffer instanceof Uint8Array) return Buffer.from(maybeBuffer.buffer);
  if (maybeBuffer.buffer instanceof ArrayBuffer) return Buffer.from(maybeBuffer.buffer);
  if (Buffer.isBuffer(maybeBuffer.value)) return maybeBuffer.value;
  if (maybeBuffer.value instanceof Uint8Array) return Buffer.from(maybeBuffer.value);
  if (Array.isArray(maybeBuffer.data)) return Buffer.from(maybeBuffer.data);

  return null;
};

const normalizeText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed || fallback;
};

const escapeHtml = (value: unknown) =>
  normalizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const truncateText = (value: unknown, maxLength: number) => {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

const formatNumber = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('pt-BR').format(value);
};

const formatCurrency = (value?: number | null, currency = 'BRL') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCompactNumber = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

const formatDateLabel = (value?: string | Date | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const normalizeImageUrl = (post: MediaKitPdfTopPost) => {
  const candidates = [
    post.thumbnailUrl,
    post.thumbnail_url,
    post.coverUrl,
    post.cover_url,
    post.previewImageUrl,
    post.preview_image_url,
  ];
  return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim())?.trim() || null;
};

const getTopPostViews = (post: MediaKitPdfTopPost) => {
  const derived = post.derivedStats?.views;
  const views = post.stats?.views;
  const reach = post.stats?.reach;
  if (typeof derived === 'number' && Number.isFinite(derived) && derived > 0) return derived;
  if (typeof views === 'number' && Number.isFinite(views) && views > 0) return views;
  if (typeof reach === 'number' && Number.isFinite(reach) && reach > 0) return reach;
  return null;
};

const normalizePercentage = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 1) return value * 100;
  return value;
};

const demographicLabelMap: Record<string, string> = {
  female: 'Feminino',
  f: 'Feminino',
  male: 'Masculino',
  m: 'Masculino',
  u: 'Nao informado',
  unknown: 'Nao informado',
  other: 'Outro',
};

const buildDemographicRows = (source?: Record<string, number> | null, maxItems = 4) => {
  if (!source) return [];
  const entries = Object.entries(source)
    .map(([rawLabel, rawValue]) => ({
      rawLabel,
      rawValue: Number(rawValue),
    }))
    .filter((item) => Number.isFinite(item.rawValue) && item.rawValue > 0);
  const total = entries.reduce((sum, item) => sum + item.rawValue, 0);
  const shouldNormalizeByTotal = total > 100 || entries.some((item) => item.rawValue > 100);

  return entries
    .map(({ rawLabel, rawValue }) => ({
      label: demographicLabelMap[rawLabel.toLowerCase()] || rawLabel,
      percentage: shouldNormalizeByTotal && total > 0 ? (rawValue / total) * 100 : normalizePercentage(rawValue),
    }))
    .filter((item) => item.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, maxItems);
};

const fetchJsonWithTimeout = async <T,>(url: string, timeoutMs = 6000): Promise<T | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    logger.warn(
      `[media-kit-pdf] Falha ao buscar dados auxiliares (${url}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchPdfTopPosts = async (origin: string, userId: string) => {
  const data = await fetchJsonWithTimeout<{ posts?: MediaKitPdfTopPost[] }>(
    `${origin}/api/v1/users/${encodeURIComponent(userId)}/videos/list?sortBy=views&limit=4`
  );
  return Array.isArray(data?.posts) ? data.posts : [];
};

const fetchPdfDemographics = async (origin: string, userId: string) =>
  fetchJsonWithTimeout<MediaKitPdfDemographics>(
    `${origin}/api/demographics/${encodeURIComponent(userId)}`,
  );

const renderMetricCard = (label: string, value: string | null, helper?: string | null) => {
  if (!value) return '';
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      ${helper ? `<div class="metric-helper">${escapeHtml(helper)}</div>` : ''}
    </div>
  `;
};

const renderPackageCards = (packages: MediaKitPdfPackage[], pricing: MediaKitPdfPricing, pricingPublished?: boolean | null) => {
  if (packages.length > 0) {
    return packages
      .map((pkg, index) => {
        const deliverables = Array.isArray(pkg.deliverables)
          ? pkg.deliverables.map((item) => normalizeText(item)).filter(Boolean)
          : [];
        return `
          <article class="card investment-card">
            <div class="investment-index">${index + 1}</div>
            <div class="investment-body">
              <div class="investment-topline">
                <h3>${escapeHtml(pkg.name || `Pacote ${index + 1}`)}</h3>
                <strong>${escapeHtml(formatCurrency(pkg.price ?? null, pkg.currency || 'BRL') || '')}</strong>
              </div>
              ${
                deliverables.length
                  ? `<ul class="deliverables">${deliverables.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
                  : `<p class="muted">${escapeHtml(pkg.description || 'Pacote pronto para apresentar a marcas.')}</p>`
              }
              ${pkg.description && deliverables.length ? `<p class="package-note">${escapeHtml(pkg.description)}</p>` : ''}
            </div>
          </article>
        `;
      })
      .join('');
  }

  if (pricingPublished && pricing?.result) {
    const items = [
      ['Estratégico', pricing.result.estrategico],
      ['Justo', pricing.result.justo],
      ['Premium', pricing.result.premium],
    ];
    return items
      .map(([label, value], index) => {
        const formatted = formatCurrency(value as number | null);
        if (!formatted) return '';
        return `
          <article class="card investment-card">
            <div class="investment-index">${index + 1}</div>
            <div class="investment-body">
              <div class="investment-topline">
                <h3>${escapeHtml(label)}</h3>
                <strong>${escapeHtml(formatted)}</strong>
              </div>
              <p class="muted">Referência para negociação com a marca.</p>
            </div>
          </article>
        `;
      })
      .join('');
  }

  return '<div class="empty-card">Nenhum pacote comercial publicado para este mídia kit.</div>';
};

const renderTopPosts = (posts: MediaKitPdfTopPost[]) => {
  if (!posts.length) return '';
  return `
    <section class="section">
      <div class="section-title-row">
        <span class="section-icon indigo" aria-hidden="true"></span>
        <div>
          <h2>Conteúdo em destaque</h2>
          <p>Top posts recentes por visualizações.</p>
        </div>
      </div>
      <div class="top-post-grid">
        ${posts
          .slice(0, 4)
          .map((post, index) => {
            const imageUrl = normalizeImageUrl(post);
            const title = truncateText(post.caption || post.description || 'Conteúdo em destaque', 96);
            const views = getTopPostViews(post);
            const engagement =
              typeof post.derivedStats?.engagementRate === 'number' && Number.isFinite(post.derivedStats.engagementRate)
                ? `${post.derivedStats.engagementRate.toFixed(post.derivedStats.engagementRate >= 10 ? 1 : 2).replace('.', ',')}% ER`
                : null;
            return `
              <article class="card post-card">
                <div class="post-thumb">
                  ${
                    imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" />` : '<span>Sem capa</span>'
                  }
                  <b>${index + 1}</b>
                </div>
                <div class="post-copy">
                  <h3>${escapeHtml(title)}</h3>
                  <div class="post-meta">
                    ${formatDateLabel(post.postDate) ? `<span>${escapeHtml(formatDateLabel(post.postDate))}</span>` : ''}
                    ${views ? `<strong>${escapeHtml(formatCompactNumber(views) || '')} views</strong>` : ''}
                    ${engagement ? `<span>${escapeHtml(engagement)}</span>` : ''}
                  </div>
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
};

const renderDemographicBlock = (title: string, rows: Array<{ label: string; percentage: number }>, tone: 'green' | 'pink') => {
  if (!rows.length) return '';
  return `
    <article class="card demographic-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="bar-list">
        ${rows
          .map(
            (row) => `
              <div class="bar-row">
                <div class="bar-label">
                  <span>${escapeHtml(row.label)}</span>
                  <strong>${Math.round(row.percentage)}%</strong>
                </div>
                <div class="bar-track">
                  <div class="bar-fill ${tone}" style="width:${Math.min(row.percentage, 100)}%"></div>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </article>
  `;
};

const buildVisualPdfHtml = ({
  canonicalSlug,
  origin,
  user,
  packages,
  pricing,
  topPosts,
  demographics,
}: {
  canonicalSlug: string;
  origin: string;
  user: MediaKitPdfUser;
  packages: MediaKitPdfPackage[];
  pricing: MediaKitPdfPricing;
  topPosts: MediaKitPdfTopPost[];
  demographics: MediaKitPdfDemographics;
}) => {
  const displayName = normalizeText(user.mediaKitDisplayName, normalizeText(user.name, 'Criador'));
  const username = normalizeText(user.username, canonicalSlug).replace(/^@/, '');
  const avatarUrl = `${origin}/api/mediakit/${encodeURIComponent(canonicalSlug)}/avatar`;
  const bio = normalizeText(user.biography);
  const followers = formatNumber(user.followers_count);
  const posts = formatNumber(user.media_count);
  const reach = pricing?.metrics?.reach ? formatNumber(pricing.metrics.reach) : null;
  const engagement =
    typeof pricing?.metrics?.engagement === 'number' && Number.isFinite(pricing.metrics.engagement)
      ? `${pricing.metrics.engagement.toFixed(2).replace('.', ',')}%`
      : null;
  const followerDemo = demographics?.follower_demographics || demographics?.engaged_audience_demographics || {};
  const genderRows = buildDemographicRows(followerDemo.gender, 3);
  const ageRows = buildDemographicRows(followerDemo.age, 4);
  const cityRows = buildDemographicRows(followerDemo.city, 4);

  const metricsHtml = [
    renderMetricCard('Seguidores', followers, 'audiencia conectada'),
    renderMetricCard('Publicações', posts, 'conteúdos analisados'),
    renderMetricCard('Alcance médio', reach, 'referência comercial'),
    renderMetricCard('Engajamento', engagement, 'média do perfil'),
  ].join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <base href="${escapeHtml(origin)}/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mídia Kit - ${escapeHtml(displayName)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f4f4f5;
      color: #18181b;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 794px;
      min-height: 1123px;
      margin: 0 auto;
      padding: 28px;
      background: linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%);
    }
    .hero {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      padding: 24px;
      border-radius: 28px;
      border: 1px solid rgba(228, 228, 231, 0.9);
      background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,250,0.95));
      box-shadow: 0 18px 44px rgba(24, 24, 27, 0.08);
      break-inside: avoid;
    }
    .avatar {
      width: 92px;
      height: 92px;
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 5px;
      background: #fff;
      border: 1px solid #f4f4f5;
      overflow: hidden;
    }
    .avatar img { width: 100%; height: 100%; border-radius: 999px; object-fit: cover; display: block; }
    .eyebrow {
      margin: 0 0 6px;
      color: #d62e5e;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 34px; line-height: 1.04; letter-spacing: 0; color: #111113; }
    .handle { margin-top: 6px; color: #71717a; font-size: 14px; font-weight: 600; }
    .bio { margin-top: 14px; color: #52525b; font-size: 14px; line-height: 1.55; max-width: 520px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .chip {
      border-radius: 999px;
      padding: 7px 11px;
      background: #fdf2f8;
      color: #db2777;
      font-size: 11px;
      font-weight: 800;
    }
    .chip.secondary { background: #fff; color: #52525b; border: 1px solid #e4e4e7; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 18px;
      break-inside: avoid;
    }
    .metric-card, .card {
      border-radius: 22px;
      border: 1px solid rgba(228, 228, 231, 0.88);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 14px 34px rgba(24, 24, 27, 0.06);
    }
    .metric-card {
      min-height: 104px;
      padding: 17px;
      background-image: radial-gradient(circle at top right, rgba(214, 46, 94, 0.09), transparent 44%);
      break-inside: avoid;
    }
    .metric-label {
      color: #71717a;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .metric-value {
      margin-top: 16px;
      color: #111113;
      font-size: 24px;
      line-height: 1.05;
      font-weight: 850;
    }
    .metric-helper {
      margin-top: 7px;
      color: #a1a1aa;
      font-size: 10px;
      font-weight: 600;
    }
    .section { margin-top: 24px; break-inside: avoid; }
    .demographics-section { break-before: page; padding-top: 28px; }
    .section-title-row {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 13px;
    }
    .section-title-row h2 { font-size: 18px; line-height: 1.15; color: #18181b; }
    .section-title-row p { margin-top: 3px; color: #71717a; font-size: 12px; }
    .section-icon {
      position: relative;
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      font-weight: 900;
    }
    .section-icon.amber { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
    .section-icon.indigo { background: #eef2ff; color: #6366f1; border: 1px solid #e0e7ff; }
    .section-icon.green { background: #ecfdf5; color: #059669; border: 1px solid #d1fae5; }
    .section-icon::before, .section-icon::after { content: ""; display: block; }
    .section-icon.amber::before {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      background: currentColor;
      transform: rotate(45deg);
    }
    .section-icon.indigo::before {
      width: 14px;
      height: 14px;
      border-top: 3px solid currentColor;
      border-right: 3px solid currentColor;
      border-radius: 2px;
      transform: rotate(-45deg);
    }
    .section-icon.indigo::after {
      position: absolute;
      width: 15px;
      height: 3px;
      border-radius: 999px;
      background: currentColor;
      transform: rotate(-45deg);
    }
    .section-icon.green::before {
      width: 15px;
      height: 15px;
      border-radius: 999px;
      border: 3px solid currentColor;
    }
    .section-icon.green::after {
      position: absolute;
      width: 5px;
      height: 5px;
      border-radius: 999px;
      background: currentColor;
    }
    .investment-list { display: grid; gap: 10px; }
    .investment-card {
      display: flex;
      gap: 14px;
      padding: 16px;
      break-inside: avoid;
    }
    .investment-index {
      width: 27px;
      height: 27px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      background: #fffbeb;
      color: #b45309;
      font-size: 12px;
      font-weight: 850;
    }
    .investment-body { min-width: 0; flex: 1; }
    .investment-topline {
      display: flex;
      gap: 16px;
      justify-content: space-between;
      align-items: flex-start;
    }
    .investment-topline h3 { font-size: 15px; line-height: 1.25; color: #18181b; }
    .investment-topline strong {
      white-space: nowrap;
      color: #6e1f93;
      font-size: 17px;
      line-height: 1.2;
    }
    .deliverables {
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 6px;
    }
    .deliverables li {
      position: relative;
      padding-left: 16px;
      color: #52525b;
      font-size: 12px;
      line-height: 1.45;
    }
    .deliverables li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 8px;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #f59e0b;
      opacity: 0.75;
    }
    .muted, .package-note { color: #71717a; font-size: 12px; line-height: 1.45; }
    .package-note { margin-top: 10px; padding-top: 10px; border-top: 1px solid #f4f4f5; }
    .empty-card {
      border-radius: 22px;
      border: 1px dashed #d4d4d8;
      background: rgba(255,255,255,0.76);
      padding: 22px;
      color: #71717a;
      font-size: 13px;
      text-align: center;
      break-inside: avoid;
    }
    .top-post-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .post-card {
      display: flex;
      gap: 13px;
      padding: 12px;
      min-height: 112px;
      break-inside: avoid;
    }
    .post-thumb {
      position: relative;
      width: 72px;
      height: 92px;
      flex: 0 0 auto;
      border-radius: 16px;
      overflow: hidden;
      background: #f4f4f5;
      border: 1px solid #f1f1f2;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #a1a1aa;
      font-size: 10px;
      font-weight: 700;
    }
    .post-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .post-thumb b {
      position: absolute;
      top: 7px;
      left: 7px;
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: rgba(255,255,255,0.94);
      color: #4f46e5;
      font-size: 11px;
    }
    .post-copy { min-width: 0; flex: 1; padding-top: 3px; }
    .post-copy h3 { font-size: 13px; line-height: 1.3; color: #18181b; }
    .post-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; align-items: center; }
    .post-meta span, .post-meta strong {
      font-size: 10px;
      line-height: 1;
      border-radius: 999px;
      padding: 5px 7px;
      background: #f4f4f5;
      color: #71717a;
      font-weight: 700;
    }
    .post-meta strong { color: #18181b; background: #e4e4e7; }
    .demographic-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .demographic-card { padding: 16px; break-inside: avoid; }
    .demographic-card h3 { font-size: 14px; color: #18181b; margin-bottom: 13px; }
    .bar-list { display: grid; gap: 13px; }
    .bar-label { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; color: #52525b; }
    .bar-label strong { color: #18181b; }
    .bar-track { margin-top: 6px; height: 6px; border-radius: 999px; background: #e4e4e7; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; }
    .bar-fill.green { background: linear-gradient(90deg, #10b981, #34d399); }
    .bar-fill.pink { background: linear-gradient(90deg, #d62e5e, #f97316); }
    .footer {
      margin-top: 22px;
      color: #a1a1aa;
      font-size: 10px;
      text-align: center;
    }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="hero">
      <div class="avatar"><img src="${escapeHtml(avatarUrl)}" alt="" /></div>
      <div>
        <p class="eyebrow">Mídia Kit</p>
        <h1>${escapeHtml(displayName)}</h1>
        <p class="handle">@${escapeHtml(username)}</p>
        ${bio ? `<p class="bio">${escapeHtml(bio)}</p>` : ''}
        <div class="chips">
          <span class="chip">Parceiro Data2Content</span>
          ${followers ? `<span class="chip secondary">${escapeHtml(followers)} seguidores</span>` : ''}
          ${posts ? `<span class="chip secondary">${escapeHtml(posts)} publicações</span>` : ''}
        </div>
      </div>
    </section>

    ${metricsHtml ? `<section class="metrics">${metricsHtml}</section>` : ''}

    <section class="section">
      <div class="section-title-row">
        <span class="section-icon amber" aria-hidden="true"></span>
        <div>
          <h2>Investimento sugerido</h2>
          <p>Pacotes comerciais e entregáveis para marcas.</p>
        </div>
      </div>
      <div class="investment-list">
        ${renderPackageCards(packages, pricing, user.mediaKitPricingPublished)}
      </div>
    </section>

    ${renderTopPosts(topPosts)}

    ${
      genderRows.length || ageRows.length || cityRows.length
        ? `<section class="section demographics-section">
            <div class="section-title-row">
              <span class="section-icon green" aria-hidden="true"></span>
              <div>
                <h2>Audiência & Demografia</h2>
                <p>Recortes principais do público.</p>
              </div>
            </div>
            <div class="demographic-grid">
              ${renderDemographicBlock('Gênero', genderRows, 'green')}
              ${renderDemographicBlock('Idade', ageRows, 'pink')}
              ${renderDemographicBlock('Cidades', cityRows, 'green')}
            </div>
          </section>`
        : ''
    }

    <div class="footer">Data2Content - Mídia Kit - ${escapeHtml(canonicalSlug)}</div>
  </main>
</body>
</html>`;
};

async function generateDirectPdf({
  canonicalSlug,
  user,
  packages,
  pricing,
}: {
  canonicalSlug: string;
  user: MediaKitPdfUser;
  packages: MediaKitPdfPackage[];
  pricing: MediaKitPdfPricing;
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const maxWidth = pageWidth - marginX * 2;
  let y = 18;

  const addPageIfNeeded = (needed = 10) => {
    if (y + needed <= pageHeight - 16) return;
    doc.addPage();
    y = 18;
  };

  const write = (text: string, options?: { size?: number; style?: 'normal' | 'bold'; gap?: number }) => {
    const size = options?.size ?? 10;
    const gap = options?.gap ?? 5;
    doc.setFont('helvetica', options?.style ?? 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);
    addPageIfNeeded(lines.length * gap + 4);
    doc.text(lines, marginX, y);
    y += lines.length * gap;
  };

  const section = (title: string) => {
    y += 4;
    addPageIfNeeded(14);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;
    write(title, { size: 13, style: 'bold', gap: 6 });
    y += 2;
  };

  const displayName = normalizeText(user.mediaKitDisplayName, normalizeText(user.name, 'Criador'));
  const username = normalizeText(user.username, canonicalSlug);
  const bio = normalizeText(user.biography);

  doc.setTextColor(24, 24, 27);
  write('Mídia Kit', { size: 20, style: 'bold', gap: 8 });
  write(displayName, { size: 16, style: 'bold', gap: 7 });
  write(`@${username.replace(/^@/, '')}`, { size: 11, gap: 5 });
  if (bio) {
    y += 3;
    write(bio, { size: 10, gap: 5 });
  }

  const followers = formatNumber(user.followers_count);
  const posts = formatNumber(user.media_count);
  const metrics = [followers ? `${followers} seguidores` : null, posts ? `${posts} publicações` : null].filter(Boolean);
  if (metrics.length) {
    y += 3;
    write(metrics.join(' • '), { size: 10, style: 'bold', gap: 5 });
  }

  if (user.mediaKitPricingPublished && pricing?.result) {
    section('Referências de valor');
    const values = [
      ['Estratégico', pricing.result.estrategico],
      ['Justo', pricing.result.justo],
      ['Premium', pricing.result.premium],
    ];
    values.forEach(([label, value]) => {
      const formatted = formatCurrency(value as number | null);
      if (formatted) write(`${label}: ${formatted}`, { size: 11, style: label === 'Justo' ? 'bold' : 'normal', gap: 6 });
    });
    const reach = formatNumber(pricing.metrics?.reach ?? null);
    const engagement =
      typeof pricing.metrics?.engagement === 'number' && Number.isFinite(pricing.metrics.engagement)
        ? `${pricing.metrics.engagement.toFixed(2).replace('.', ',')}%`
        : null;
    const cpm = formatCurrency(pricing.cpmApplied ?? null);
    const pricingMetrics = [reach ? `Alcance médio: ${reach}` : null, engagement ? `Engajamento: ${engagement}` : null, cpm ? `CPM aplicado: ${cpm}` : null].filter(Boolean);
    if (pricingMetrics.length) {
      y += 2;
      write(pricingMetrics.join(' • '), { size: 9, gap: 4 });
    }
  }

  section('Pacotes comerciais');
  if (packages.length === 0) {
    write('Nenhum pacote comercial publicado para este mídia kit.', { size: 10, gap: 5 });
  } else {
    packages.forEach((pkg, index) => {
      const name = normalizeText(pkg.name, `Pacote ${index + 1}`);
      const price = formatCurrency(pkg.price ?? null, pkg.currency || 'BRL');
      addPageIfNeeded(20);
      write(`${index + 1}. ${name}${price ? ` — ${price}` : ''}`, { size: 12, style: 'bold', gap: 6 });
      const description = normalizeText(pkg.description);
      if (description) write(description, { size: 9, gap: 4 });
      const deliverables = Array.isArray(pkg.deliverables) ? pkg.deliverables.map((item) => normalizeText(item)).filter(Boolean) : [];
      deliverables.forEach((item) => write(`• ${item}`, { size: 10, gap: 5 }));
      y += 3;
    });
  }

  section('Observação');
  write('Valores e entregáveis servem como referência principal para negociação com a marca.', { size: 10, gap: 5 });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.text(`Data2Content • media-kit-${canonicalSlug}.pdf • página ${page}/${pageCount}`, marginX, pageHeight - 8);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

async function launchPdfBrowser() {
  ensureLocalPlaywrightBrowsersPath();
  const { chromium } = await import('playwright');
  const chromiumArgs = resolveChromiumArgs();
  const serverlessAttempt = await resolveServerlessChromiumAttempt(chromiumArgs);
  const launchAttempts: ChromiumLaunchAttempt[] = [
    ...(serverlessAttempt ? [serverlessAttempt] : []),
    { label: 'playwright-managed' },
    ...resolveExecutableCandidates().map((candidate) => ({
      label: `executable:${candidate}`,
      executablePath: candidate,
    })),
  ];

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let launchError: unknown = null;
  for (const attempt of launchAttempts) {
    try {
      browser = await chromium.launch({
        headless: true,
        args: attempt.args ?? chromiumArgs,
        ...(attempt.executablePath ? { executablePath: attempt.executablePath } : {}),
      });
      break;
    } catch (error) {
      launchError = error;
      logger.warn(
        `[media-kit-pdf] Falha ao iniciar Chromium (${attempt.label}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  if (!browser) {
    throw launchError instanceof Error ? launchError : new Error('Falha ao iniciar o navegador de exportação de PDF.');
  }

  return browser;
}

async function generatePdf(url: string) {
  const browser = await launchPdfBrowser();

  const context = await browser.newContext({
    viewport: { width: 900, height: 1270 },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
  });

  const page = await context.newPage();
  try {
    await page.route('**/*', async (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      if (resourceType === 'media' || resourceType === 'websocket' || resourceType === 'eventsource') {
        await route.abort();
        return;
      }
      await route.continue();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    // Recursos externos podem demorar ou manter conexões abertas. Esperamos um pouco por
    // estabilidade, mas não deixamos isso bloquear a exportação inteira.
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => undefined);

    // Forçamos o modo 'screen' para garantir que o layout mobile/visual seja mantido
    await page.emulateMedia({ media: 'screen' });

    // Garantimos que as fontes estejam carregadas
    await page.evaluate(() => (document as any).fonts?.ready ?? Promise.resolve());

    // Pequena pausa para garantir que animações iniciais de entrada (framer-motion) terminem
    await page.waitForTimeout(1000);

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function generateVisualPdf(html: string) {
  const browser = await launchPdfBrowser();
  const context = await browser.newContext({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
  });

  const page = await context.newPage();
  try {
    await page.route('**/*', async (route) => {
      const resourceType = route.request().resourceType();
      if (
        resourceType === 'script' ||
        resourceType === 'font' ||
        resourceType === 'media' ||
        resourceType === 'websocket' ||
        resourceType === 'eventsource'
      ) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => (document as any).fonts?.ready ?? Promise.resolve());
    await page
      .evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(
          images.map(
            (image) =>
              image.complete ||
              new Promise<void>((resolve) => {
                image.onload = () => resolve();
                image.onerror = () => resolve();
              })
          )
        );
      })
      .catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined);
    await page.waitForTimeout(300);

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Media Kit não encontrado.' }, { status: 404 });
  }

  const ip = getClientIp(req) ?? 'unknown';
  try {
    await limiter.check(ip);
  } catch {
    return NextResponse.json(
      { error: 'Limite de exportações atingido. Tente novamente mais tarde.' },
      { status: 429 }
    );
  }

  await connectToDatabase();
  const resolvedToken = await resolveMediaKitToken(token);
  if (!resolvedToken?.userId) {
    return NextResponse.json({ error: 'Media Kit não encontrado.' }, { status: 404 });
  }

  const user = await User.findById(resolvedToken.userId)
    .select('_id name mediaKitDisplayName username biography followers_count media_count mediaKitSlug updatedAt mediaKitPricingPublished')
    .lean();
  if (!user?._id || !user.mediaKitSlug) {
    return NextResponse.json({ error: 'Media Kit não encontrado.' }, { status: 404 });
  }
  const canonicalSlug = String(user.mediaKitSlug);

  const [latestPricing, packages] = (await Promise.all([
    PubliCalculation.findOne({ userId: user._id }).sort({ updatedAt: -1 }).select('updatedAt result metrics cpmApplied createdAt').lean(),
    MediaKitPackage.find({ userId: user._id })
      .sort({ order: 1, createdAt: 1 })
      .select('name price currency deliverables description updatedAt')
      .lean(),
  ])) as [
    (MediaKitPdfPricing & { updatedAt?: Date }) | null,
    Array<MediaKitPdfPackage & { updatedAt?: Date }>,
  ];
  const latestPackage = packages.reduce<{ updatedAt?: Date } | null>((latest, pkg) => {
    if (!pkg?.updatedAt) return latest;
    if (!latest?.updatedAt || new Date(pkg.updatedAt).getTime() > new Date(latest.updatedAt).getTime()) {
      return { updatedAt: pkg.updatedAt };
    }
    return latest;
  }, null);
  const renderer = resolvePdfRenderer();

  const versionKey = buildCacheKey(canonicalSlug, [
    PDF_CACHE_VERSION,
    `renderer:${renderer}`,
    user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
    latestPricing?.updatedAt ? new Date(latestPricing.updatedAt).toISOString() : null,
    latestPackage?.updatedAt ? new Date(latestPackage.updatedAt).toISOString() : null,
    user.mediaKitPricingPublished ? 'pricing:1' : 'pricing:0',
  ]);

  const { cacheDir, cacheFile } = getCacheFilePath(versionKey);
  const cached = await readCachedPdf(versionKey, cacheFile);
  if (cached?.buffer) {
    return toPdfResponse(cached.buffer, `media-kit-${canonicalSlug}.pdf`);
  }

  const origin = resolveAppOrigin(req);
  let targetUrl: string | null = null;

  try {
    if (renderer === 'direct') {
      logger.debug(`[media-kit-pdf] Gerando PDF direto para ${canonicalSlug}`);
      const pdfBuffer = await generateDirectPdf({
        canonicalSlug,
        user: user as MediaKitPdfUser,
        packages: packages as MediaKitPdfPackage[],
        pricing: latestPricing as MediaKitPdfPricing,
      });
      await writeCachedPdf(versionKey, cacheDir, cacheFile, pdfBuffer);
      return toPdfResponse(pdfBuffer, `media-kit-${canonicalSlug}.pdf`);
    }

    if (renderer === 'visual') {
      logger.debug(`[media-kit-pdf] Gerando PDF visual leve para ${canonicalSlug}`);
      const userId = String(user._id);
      const [topPosts, demographics] = await Promise.all([
        fetchPdfTopPosts(origin, userId),
        fetchPdfDemographics(origin, userId),
      ]);
      const html = buildVisualPdfHtml({
        canonicalSlug,
        origin,
        user: user as MediaKitPdfUser,
        packages: packages as MediaKitPdfPackage[],
        pricing: latestPricing as MediaKitPdfPricing,
        topPosts,
        demographics,
      });
      const pdfBuffer = Buffer.from(await generateVisualPdf(html));
      await writeCachedPdf(versionKey, cacheDir, cacheFile, pdfBuffer);
      return toPdfResponse(pdfBuffer, `media-kit-${canonicalSlug}.pdf`);
    }

    targetUrl = `${origin}/mediakit/${canonicalSlug}?print=1`;
    logger.debug(`[media-kit-pdf] Iniciando geração para ${targetUrl} (origin: ${origin})`);
    const pdfBuffer = Buffer.from(await generatePdf(targetUrl));
    await writeCachedPdf(versionKey, cacheDir, cacheFile, pdfBuffer);
    return toPdfResponse(pdfBuffer, `media-kit-${canonicalSlug}.pdf`);
  } catch (error) {
    const missingBrowserBinary = isMissingBrowserBinaryError(error);
    logger.error('[media-kit-pdf] Falha ao gerar PDF', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      targetUrl,
      origin,
      renderer,
      missingBrowserBinary,
      playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || null,
      chromiumBin: process.env.PLAYWRIGHT_CHROMIUM_BIN || process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.CHROME_BIN || null,
    });
    return NextResponse.json(
      {
        error: missingBrowserBinary
          ? 'Serviço de exportação de PDF temporariamente indisponível. Tente novamente em instantes.'
          : 'Não foi possível gerar o PDF agora. Tente novamente em instantes.',
      },
      { status: missingBrowserBinary ? 503 : 500 }
    );
  }
}
