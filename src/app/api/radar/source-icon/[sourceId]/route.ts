import { NextResponse } from "next/server";
import {
  fallbackIconPaths,
  parseIconLinks,
  sourceIconOrigin,
} from "@/app/lib/campaignRadar/sourceIcon";

export const runtime = "nodejs";
// Ícone muda uma vez por ano; a borda guarda por uma semana e serve o antigo
// enquanto revalida. Assim a lista de publis não espera rede nenhuma.
const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
const TIMEOUT_MS = 4000;
const HTML_TIMEOUT_MS = 5000;
const MAX_BYTES = 400_000;
const MAX_HTML_BYTES = 300_000;
const MAX_CANDIDATES = 6;
/**
 * Duas tentativas, nesta ordem, porque as plataformas se dividem: parte recusa
 * quem não parece navegador (403), e parte recusa justamente quem parece — o
 * WhatsApp devolve 400 para o disfarce e 200 para o pedido simples. Sem disfarce
 * primeiro, com disfarce só se a primeira falhar.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchTwice(url: string, accept: string, timeout: number) {
  for (const agent of [null, UA]) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        redirect: "follow",
        headers: agent ? { accept, "user-agent": agent } : { accept },
      });
      if (response.ok) return response;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Fonte sem ícone responde 404 de propósito: assim o app troca a imagem pela
 * letra da fonte. Devolver um pixel transparente com sucesso deixava um selo
 * vazio na lista, porque para o navegador a imagem tinha carregado.
 */
function missing() {
  return new NextResponse("sem icone", {
    status: 404,
    headers: { "Cache-Control": CACHE, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Os endereços que o site declara no HTML vêm antes dos palpites de sempre. */
async function iconCandidates(origin: string): Promise<string[]> {
  // Home fora do ar ou bloqueada: seguem os palpites de sempre.
  const response = await fetchTwice(origin, "text/html,*/*;q=0.8", HTML_TIMEOUT_MS);
  if (!response) return fallbackIconPaths(origin);
  try {
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const declared = parseIconLinks(html, response.url || origin);
    return [...new Set([...declared, ...fallbackIconPaths(origin)])].slice(0, MAX_CANDIDATES);
  } catch {
    return fallbackIconPaths(origin);
  }
}

async function fetchIcon(candidates: string[]) {
  for (const candidate of candidates) {
    const response = await fetchTwice(candidate, "image/*,*/*;q=0.8", TIMEOUT_MS);
    if (!response) continue;
    const type = response.headers.get("content-type") || "";
    // Site que devolve a própria página no lugar do ícone é comum: sem esta
    // conferência o selo receberia HTML e viraria imagem quebrada.
    if (!type.startsWith("image/")) continue;
    try {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) continue;
      return { buffer, type };
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  const { sourceId } = await context.params;
  const origin = sourceIconOrigin(sourceId);
  if (!origin) return missing();

  const icon = await fetchIcon(await iconCandidates(origin));
  if (!icon) return missing();

  return new NextResponse(icon.buffer as unknown as BodyInit, {
    headers: { "Content-Type": icon.type, "Cache-Control": CACHE },
  });
}
