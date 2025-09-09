// Use global fetch (Node/Next runtime)

export interface ExternalSignal {
  title: string;
  url?: string;
  source?: string;
  publishedAt?: string;
}

function buildQuery(keywords: string[]): string {
  const q = keywords
    .map(k => (k || '').toString().trim())
    .filter(Boolean)
    .map(k => `"${k.replace(/"/g, '')}"`)
    .join(" OR ");
  return encodeURIComponent(q || 'Instagram Reels conteúdo');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function fetchGoogleNewsSignals(
  keywords: string[],
  opts: { lang?: string; country?: string; limit?: number; timeoutMs?: number } = {}
): Promise<ExternalSignal[]> {
  const { lang = 'pt-BR', country = 'BR', limit = 3, timeoutMs = 4500 } = opts;
  const query = buildQuery(keywords);
  const url = `https://news.google.com/rss/search?q=${query}&hl=${encodeURIComponent(lang)}&gl=${encodeURIComponent(country)}&ceid=${encodeURIComponent(country + ':' + (lang.split('-')[0] || 'pt'))}`;

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal } as any);
    clearTimeout(to);
    if (!res.ok) return [];
    const xml = await res.text();
    const items: ExternalSignal[] = [];
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const block of itemBlocks) {
      const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
      const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const title = decodeEntities(titleMatch?.[1] || titleMatch?.[2] || '').trim();
      const url = (linkMatch?.[1] || '').trim();
      const publishedAt = (pubMatch?.[1] || '').trim();
      if (!title) continue;
      items.push({ title, url, publishedAt, source: 'GoogleNews' });
      if (items.length >= limit) break;
    }
    return items;
  } catch {
    return [];
  }
}

export default fetchGoogleNewsSignals;
