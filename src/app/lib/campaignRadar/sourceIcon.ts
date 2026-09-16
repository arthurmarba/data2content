import { campaignRadarSourceRegistry } from "./sourceRegistry";

/**
 * O ícone da plataforma sai do domínio dela, mas é servido por nós: o navegador
 * de quem usa o app não avisa quarenta e cinco sites que alguém está olhando as
 * publis. A porta do criador (`creatorEntryUrl`) é o domínio certo — o
 * `publicCheckUrl` às vezes aponta para sitemap, linktree ou feed JSON.
 */
export function sourceIconOrigin(sourceId: string): string | null {
  const entry = campaignRadarSourceRegistry.find((source) => source.sourceId === sourceId);
  if (!entry) return null;
  for (const candidate of [entry.creatorEntryUrl, entry.publicCheckUrl]) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Ícone genérico de plataforma de terceiros não identifica fonte nenhuma: uma
 * chamada hospedada no Google Forms devolveria o logo do Firebase para todas.
 * Nesses casos a letra da fonte informa mais do que a imagem.
 */
const GENERIC_ICON_HOST = /(^|\.)gstatic\.com$|(^|\.)googleusercontent\.com$/i;

function isGenericIcon(url: string): boolean {
  try {
    return GENERIC_ICON_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Quanto maior o lado declarado, melhor: o selo da lista tem 44px de tela. */
function declaredSize(tag: string): number {
  const sizes = tag.match(/sizes=["']([^"']+)["']/i)?.[1] ?? "";
  const sides = [...sizes.matchAll(/(\d+)\s*[x×]\s*(\d+)/gi)].map((m) => Number(m[1]));
  if (sides.length) return Math.max(...sides);
  return /apple-touch-icon/i.test(tag) ? 180 : 0;
}

/**
 * A maioria dos sites não deixa mais o ícone em `/favicon.ico`: declara no HTML
 * e serve de um CDN. Sem ler o HTML, quase metade das fontes ficava sem imagem.
 */
export function parseIconLinks(html: string, baseUrl: string): string[] {
  const found: { href: string; size: number }[] = [];
  for (const match of html.matchAll(/<link[^>]+>/gi)) {
    const tag = match[0];
    if (!/rel=["'][^"']*icon/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      found.push({ href: new URL(href, baseUrl).toString(), size: declaredSize(tag) });
    } catch {
      continue;
    }
  }
  const ordered = found.sort((a, b) => b.size - a.size).map((item) => item.href);
  return [...new Set(ordered)].filter((href) => !isGenericIcon(href));
}

/** Os palpites de sempre, para quem não declara nada: o maior primeiro. */
export function fallbackIconPaths(origin: string): string[] {
  return [`${origin}/apple-touch-icon.png`, `${origin}/favicon.png`, `${origin}/favicon.ico`];
}
