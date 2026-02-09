import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

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
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1600 },
    deviceScaleFactor: 2,
    locale: 'pt-BR',
  });

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => (document as any).fonts?.ready ?? Promise.resolve());
    await page.waitForTimeout(500);
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
    const pdfBuffer = await generatePdf(targetUrl);
    await writeCachedPdf(versionKey, cacheDir, cacheFile, pdfBuffer as Buffer);
    return toPdfResponse(pdfBuffer as Buffer, `media-kit-${canonicalSlug}.pdf`);
  } catch (error) {
    logger.error('[media-kit-pdf] Falha ao gerar PDF', error as Error);
    return NextResponse.json(
      { error: 'Não foi possível gerar o PDF agora. Tente novamente em instantes.' },
      { status: 500 }
    );
  }
}
