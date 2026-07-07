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
const shouldUseDirectPdfRenderer = () =>
  shouldUseServerlessChromium() && process.env.MEDIA_KIT_PDF_RENDERER !== 'browser';

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

async function generatePdf(url: string) {
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

  const versionKey = buildCacheKey(canonicalSlug, [
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
  const targetUrl = `${origin}/mediakit/${canonicalSlug}?print=1`;

  try {
    if (shouldUseDirectPdfRenderer()) {
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

    logger.debug(`[media-kit-pdf] Iniciando geração para ${targetUrl} (origin: ${origin})`);
    const pdfBuffer = await generatePdf(targetUrl);
    await writeCachedPdf(versionKey, cacheDir, cacheFile, pdfBuffer as Buffer);
    return toPdfResponse(pdfBuffer as Buffer, `media-kit-${canonicalSlug}.pdf`);
  } catch (error) {
    const missingBrowserBinary = isMissingBrowserBinaryError(error);
    logger.error('[media-kit-pdf] Falha ao gerar PDF', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      targetUrl,
      origin,
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
