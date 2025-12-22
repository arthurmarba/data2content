// src/app/api/proxy/thumbnail/[...path]/route.ts
import { NextRequest } from "next/server";
import { logger } from "@/app/lib/logger";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createHash } from "crypto";

export const runtime = "nodejs";

/**
 * Diretório de cache
 * - Em serverless, /var/task é read-only. /tmp (os.tmpdir()) é gravável.
 * - Permite desabilitar o cache via DISABLE_DISK_CACHE=true
 */
const DISABLE_DISK_CACHE = String(process.env.DISABLE_DISK_CACHE || "").toLowerCase() === "true";
const CACHE_DIR =
  process.env.THUMBNAIL_CACHE_DIR ||
  path.join(os.tmpdir(), "thumbnail-cache");

function canDiskCache() {
  return !DISABLE_DISK_CACHE;
}

function isReadOnlyFs(err: any) {
  return (
    err?.code === "EROFS" ||
    err?.code === "EACCES" ||
    /read[- ]?only/i.test(String(err?.message))
  );
}

/**
 * TTL de cache no browser/CDN (24h).
 */
const BROWSER_MAX_AGE_SEC = 60 * 60 * 24;

/**
 * Hosts permitidos — restringe o proxy a domínios que de fato usamos.
 */
const ALLOWED_HOSTS_SUFFIX = [
  "fbcdn.net",
  "xx.fbcdn.net",
  "cdninstagram.com",
  "lookaside.instagram.com",
  "lookaside.fbsbx.com",
  "platform-lookaside.fbsbx.com",
  "graph.facebook.com",
  "lh3.googleusercontent.com",
  "placehold.co",
  "i.ibb.co",
];

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOSTS_SUFFIX.some((s) => h === s || h.endsWith(`.${s}`));
}

/**
 * Mapeamento simples de content-type -> extensão (apenas para logs/diagnóstico).
 * Obs: não dependemos da extensão para servir; usamos o content-type salvo no .json
 */
const CT_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
};

function guessExtFromContentType(ct?: string | null): string {
  const clean = ((ct ?? "").split(";")[0] ?? "").trim().toLowerCase();
  return CT_TO_EXT[clean] || ".bin";
}

/**
 * Arquivos de cache:
 *  - <hash>.bin   -> bytes da imagem
 *  - <hash>.json  -> { contentType, url, createdAt }
 */
function hashOf(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

async function fileExists(p: string) {
  try {
    await fs.promises.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const urlIn = new URL(req.url);
  const strict = ['1', 'true', 'yes'].includes((urlIn.searchParams.get('strict') || '').toLowerCase());
  // Recompõe a URL alvo a partir dos segmentos (espera-se que venha encodeURIComponent no cliente)
  const encoded = params.path?.join("/") ?? "";
  const targetUrl = decodeURIComponent(encoded);

  if (!targetUrl) {
    return new Response("Missing URL", { status: 400 });
  }

  let urlObj: URL;
  try {
    urlObj = new URL(targetUrl);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  // Apenas HTTPS e apenas hosts conhecidos
  if (urlObj.protocol !== "https:") {
    return new Response("Only HTTPS is allowed", { status: 400 });
  }
  if (!isAllowedHost(urlObj.hostname)) {
    logger.warn("[thumbnail-proxy] Blocked host.", { host: urlObj.hostname });
    return new Response("Host not allowed", { status: 403 });
  }

  const key = hashOf(targetUrl);
  const base = path.join(CACHE_DIR, key);
  const dataPath = `${base}.bin`;
  const metaPath = `${base}.json`;

  try {
    // Cria diretório de cache se o disco-cache estiver habilitado
    if (canDiskCache()) {
      try {
        await fs.promises.mkdir(CACHE_DIR, { recursive: true });
      } catch (e) {
        if (isReadOnlyFs(e)) {
          logger.warn("[thumbnail-proxy] Disk cache disabled (read-only FS). Proceeding without cache.", {
            cacheDir: CACHE_DIR,
          });
        } else {
          logger.error("[thumbnail-proxy] Failed to ensure cache directory.", e);
        }
      }
    }

    // Cache hit — tenta ler meta p/ content-type correto
    if (await fileExists(dataPath)) {
      let contentType = "application/octet-stream";
      try {
        const metaRaw = await fs.promises.readFile(metaPath, "utf8");
        const meta = JSON.parse(metaRaw);
        if (typeof meta?.contentType === "string") {
          contentType = meta.contentType;
        }
      } catch {
        // sem meta; segue com octet-stream
      }

      const stream = fs.createReadStream(dataPath);
      return new Response(stream as any, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": `public, max-age=${BROWSER_MAX_AGE_SEC}`,
        },
      });
    }

    // Cache miss — busca upstream
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        // Alguns CDNs do Instagram exigem referer/origin plausíveis
        referer: "https://www.instagram.com/",
        origin: "https://www.instagram.com",
        "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      redirect: "follow",
      cache: "no-store",
    });

  if (!upstreamRes.ok || !upstreamRes.body) {
    logger.error(
      `[thumbnail-proxy] Upstream fetch failed for ${targetUrl}: ${upstreamRes.status}`
    );
    if (strict) {
      return new Response("Upstream image fetch failed", { status: 502 });
    }
    // Fallback: PNG 1x1 cinza (visível) para evitar "buracos"
    const grayPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAADUlEQVR42mP8z8AARQMD8Z1kGAAAAABJRU5ErkJggg==",
      "base64"
    );
    return new Response(grayPng, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${60 * 5}`, // 5 minutos apenas
      },
    });
  }

    const contentType =
      upstreamRes.headers.get("content-type") || "application/octet-stream";
    const extFromCT = guessExtFromContentType(contentType);

    // Tee o body para gravar no cache e devolver ao cliente
    const [cacheStream, responseStream] = upstreamRes.body.tee();

    // Gravação atômica no disco (se habilitado). Se falhar por RO, apenas loga e segue.
    if (canDiskCache()) {
      (async () => {
        const partDataPath = `${dataPath}.part`;
        const partMetaPath = `${metaPath}.part`;
        try {
          const nodeStream = Readable.fromWeb(cacheStream as any);
          const writable = fs.createWriteStream(partDataPath);
          await pipeline(nodeStream, writable);
          await fs.promises.rename(partDataPath, dataPath);

          const meta = {
            url: targetUrl,
            contentType,
            ext: extFromCT,
            createdAt: new Date().toISOString(),
          };
          await fs.promises.writeFile(partMetaPath, JSON.stringify(meta), "utf8");
          await fs.promises.rename(partMetaPath, metaPath);
        } catch (err) {
          // Limpa .part se algo der errado
          try {
            await fs.promises.rm(partDataPath, { force: true });
            await fs.promises.rm(partMetaPath, { force: true });
          } catch {}
          if (isReadOnlyFs(err)) {
            logger.warn(
              `[thumbnail-proxy] Disk cache disabled (read-only FS). Proceeding without cache.`,
              { targetUrl, dataPath }
            );
          } else {
            logger.error(
              `[thumbnail-proxy] Failed to cache image for ${targetUrl}`,
              err
            );
          }
        }
      })();
    } else {
      // cache desabilitado por env
      // nada a fazer; apenas servimos o fluxo ao cliente
    }

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", `public, max-age=${BROWSER_MAX_AGE_SEC}`);

    return new Response(responseStream, { headers });
  } catch (err) {
    logger.error(`[thumbnail-proxy] Unexpected error for ${targetUrl}`, err);
    if (strict) {
      return new Response("Proxy unexpected error", { status: 500 });
    }
    // Fallback: PNG 1x1 cinza (visível)
    const grayPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAADUlEQVR42mP8z8AARQMD8Z1kGAAAAABJRU5ErkJggg==",
      "base64"
    );
    return new Response(grayPng, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${60 * 5}`,
      },
    });
  }
}
