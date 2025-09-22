import { NextRequest } from 'next/server';
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import { backfillPostCover } from '@/app/lib/dataService/marketAnalysis/postsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function originFrom(req: NextRequest): string {
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

function needsIgHeaders(u: URL) {
  const h = u.hostname.toLowerCase();
  return (
    h.endsWith('.cdninstagram.com') ||
    h.endsWith('.fbcdn.net') ||
    h === 'cdninstagram.com' ||
    h === 'fbcdn.net'
  );
}

async function fetchAsStream(url: string) {
  let headers: Record<string, string> | undefined;
  try {
    const u = new URL(url);
    if (needsIgHeaders(u)) {
      headers = {
        referer: 'https://www.instagram.com/',
        origin: 'https://www.instagram.com',
        'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        accept:
          'image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      };
    }
  } catch {}

  const res = await fetch(url, { cache: 'no-store', redirect: 'follow', headers });
  if (!res.ok || !res.body) return null;
  const ct = res.headers.get('content-type') || 'application/octet-stream';
  return new Response(res.body, {
    headers: {
      'Content-Type': ct,
      'Cache-Control': `public, max-age=${60 * 60}`,
    },
  });
}

function gray1x1() {
  const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAADUlEQVR42mP8z8AARQMD8Z1kGAAAAABJRU5ErkJggg==', 'base64');
  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${60 * 5}`,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const TAG = '[api/media/cover]';
  const id = params?.id;
  if (!id) return new Response(null, { status: 404 });

  try {
    await connectToDatabase();
    const doc = await MetricModel.findById(id).select('coverUrl instagramMediaId user').lean();
    if (!doc) return new Response(null, { status: 404 });

    const origin = originFrom(req);

    // 1) Tenta servir a cover atual (se já existir)
    if (doc.coverUrl) {
      try {
        let abs = doc.coverUrl.startsWith('/') ? `${origin}${doc.coverUrl}` : doc.coverUrl;
        // Quando usamos o proxy interno, pedimos modo estrito para detectar falha upstream
        if (abs.startsWith(`${origin}/api/proxy/thumbnail/`)) {
          abs = abs.includes('?') ? `${abs}&strict=1` : `${abs}?strict=1`;
        }
        const r = await fetchAsStream(abs);
        if (r) return r;
      } catch (e) {
        logger.warn(`${TAG} coverUrl fetch failed, will try backfill`, e);
      }
    }

    // 2) Backfill via Graph API e tenta novamente
    try {
      const res = await backfillPostCover(id, { force: true });
      logger.info(`${TAG} backfill result for ${id}: ${res.success} - ${res.message}`);
      const fresh = await MetricModel.findById(id).select('coverUrl').lean();
      const newUrl = fresh?.coverUrl;
      if (newUrl) {
        let abs = newUrl.startsWith('/') ? `${origin}${newUrl}` : newUrl;
        if (abs.startsWith(`${origin}/api/proxy/thumbnail/`)) {
          abs = abs.includes('?') ? `${abs}&strict=1` : `${abs}?strict=1`;
        }
        const r = await fetchAsStream(abs);
        if (r) return r;
      }
    } catch (e) {
      logger.error(`${TAG} backfill error for ${id}`, e);
    }

    // 3) Sem capa disponível — retorna 404 para permitir fallback no cliente (onError)
    return new Response(null, { status: 404 });
  } catch (err) {
    logger.error(`${TAG} unexpected error`, err);
    return new Response(null, { status: 404 });
  }
}

export async function HEAD(req: NextRequest, { params }: { params: { id: string } }) {
  const TAG = '[api/media/cover][HEAD]';
  const id = params?.id;
  if (!id) return new Response(null, { status: 404 });

  try {
    await connectToDatabase();
    const doc = await MetricModel.findById(id).select('coverUrl instagramMediaId user').lean();
    if (!doc) return new Response(null, { status: 404 });

    const origin = originFrom(req);

    // 1) Testa a cover atual (se existir)
    if (doc.coverUrl) {
      try {
        let abs = doc.coverUrl.startsWith('/') ? `${origin}${doc.coverUrl}` : doc.coverUrl;
        if (abs.startsWith(`${origin}/api/proxy/thumbnail/`)) {
          abs = abs.includes('?') ? `${abs}&strict=1` : `${abs}?strict=1`;
        }
        // Fetch sem stream, apenas para verificar status
        let headers: Record<string, string> | undefined;
        try {
          const u = new URL(abs);
          if (needsIgHeaders(u)) {
            headers = {
              referer: 'https://www.instagram.com/',
              origin: 'https://www.instagram.com',
              'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8',
              'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
              accept:
                'image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
              'cache-control': 'no-cache',
              pragma: 'no-cache',
            };
          }
        } catch {}
        const res = await fetch(abs, { cache: 'no-store', redirect: 'follow', headers });
        if (res.ok) return new Response(null, { status: 200 });
      } catch {}
    }

    // 2) Tenta backfill forçado
    try {
      const back = await backfillPostCover(id, { force: true });
      logger.info(`${TAG} backfill result for ${id}: ${back.success} - ${back.message}`);
      if (back.success) {
        const fresh = await MetricModel.findById(id).select('coverUrl').lean();
        const newUrl = fresh?.coverUrl;
        if (newUrl) {
          let abs = newUrl.startsWith('/') ? `${origin}${newUrl}` : newUrl;
          if (abs.startsWith(`${origin}/api/proxy/thumbnail/`)) {
            abs = abs.includes('?') ? `${abs}&strict=1` : `${abs}?strict=1`;
          }
          const res = await fetch(abs, { cache: 'no-store', redirect: 'follow' });
          if (res.ok) return new Response(null, { status: 200 });
        }
      }
    } catch {}

    return new Response(null, { status: 404 });
  } catch (err) {
    logger.error(`${TAG} unexpected error`, err);
    return new Response(null, { status: 404 });
  }
}
