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
const DEFAULT_CHROMIUM_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

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
        return { buffer: record.data as Buffer, contentType: record.contentType || 'application/pdf' };
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

async function generatePdf(url: string) {
  ensureLocalPlaywrightBrowsersPath();
  const { chromium } = await import('playwright');
  const chromiumArgs = resolveChromiumArgs();
  const launchAttempts: Array<{ label: string; executablePath?: string }> = [
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
        args: chromiumArgs,
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
    viewport: { width: 1200, height: 1600 },
    deviceScaleFactor: 2,
    locale: 'pt-BR',
  });

  const page = await context.newPage();
  try {
    // Usamos 'load' em vez de 'networkidle' para evitar timeouts causados por rastreadores
    // ou conexões persistentes que não impedem a renderização visual.
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });

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
    .select('_id mediaKitSlug updatedAt mediaKitPricingPublished')
    .lean();
  if (!user?._id || !user.mediaKitSlug) {
    return NextResponse.json({ error: 'Media Kit não encontrado.' }, { status: 404 });
  }
  const canonicalSlug = String(user.mediaKitSlug);

  const [latestPricing, latestPackage] = (await Promise.all([
    PubliCalculation.findOne({ userId: user._id }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
    MediaKitPackage.findOne({ userId: user._id }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
  ])) as Array<{ updatedAt?: Date } | null>;

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
