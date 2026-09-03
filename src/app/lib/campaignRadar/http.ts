const USER_AGENT =
  "Data2Content-Public-Campaign-Radar/0.1 (+https://data2content.ai; contato@data2content.ai)";

export async function fetchPublicText(url: string, timeoutMs = 20_000): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`unsupported_protocol:${parsed.protocol}`);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(parsed, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
          "User-Agent": USER_AGENT,
        },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }
        throw new Error(`http_${response.status}:${url}`);
      }

      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > 5_000_000) throw new Error(`response_too_large:${url}`);

      const text = await response.text();
      if (text.length > 5_000_000) throw new Error(`response_too_large:${url}`);
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`fetch_failed:${url}`);
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, values.length)) }, worker));
  return results;
}
