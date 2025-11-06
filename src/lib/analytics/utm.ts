export type UtmContext = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  referrer?: string | null;
  first_touch_at?: string | null;
  last_touch_at?: string | null;
};

const STORAGE_KEY = 'd2c::utm_context';
const COOKIE_KEY = 'd2c_utm';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const sanitizeValue = (value: unknown): string | null | undefined => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const pickUtmFromObject = (input: Record<string, unknown>): Partial<UtmContext> => {
  const result: Partial<UtmContext> = {};
  for (const key of [...UTM_KEYS, 'referrer'] as const) {
    const value = sanitizeValue(input[key as keyof typeof input]);
    if (value) {
      result[key as keyof UtmContext] = value;
    }
  }
  return result;
};

const encodeCookieValue = (context: UtmContext): string => {
  try {
    return encodeURIComponent(JSON.stringify(context));
  } catch {
    return '';
  }
};

export const decodeCookieValue = (value: string | undefined | null): UtmContext | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as UtmContext;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeCookie = (context: UtmContext) => {
  if (!isBrowser()) return;
  const value = encodeCookieValue(context);
  if (!value) return;
  const secure = window.location.protocol === 'https:' ? ';Secure' : '';
  document.cookie = `${COOKIE_KEY}=${value};Path=/;Max-Age=${COOKIE_MAX_AGE};SameSite=Lax${secure}`;
};

const readCookie = (): UtmContext | null => {
  if (!isBrowser()) return null;
  const cookies = document.cookie?.split(';') ?? [];
  const cookie = cookies
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COOKIE_KEY}=`));

  if (!cookie) return null;
  const [, rawValue] = cookie.split('=');
  return decodeCookieValue(rawValue);
};

const readStorage = (): UtmContext | null => {
  if (!isBrowser()) return null;
  const sources = [sessionStorage, localStorage];
  for (const storage of sources) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as UtmContext;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // ignore corrupted storage
    }
  }
  return null;
};

const writeStorage = (context: UtmContext) => {
  if (!isBrowser()) return;
  const serialized = JSON.stringify(context);
  try {
    sessionStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // ignore quota exceeded
  }
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // ignore quota exceeded
  }
};

const mergeContexts = (existing: UtmContext | null, incoming: Partial<UtmContext>): UtmContext => {
  const next: UtmContext = existing ? { ...existing } : {};
  let hasNewValue = false;

  for (const key of UTM_KEYS) {
    const value = sanitizeValue(incoming[key]);
    if (!value) continue;
    if (!next[key]) {
      next[key] = value;
      hasNewValue = true;
    } else {
      // Always keep first touch attempt, but record last touch.
      next[key] = next[key] ?? value;
    }
  }

  if (incoming.referrer && !next.referrer) {
    next.referrer = sanitizeValue(incoming.referrer);
    hasNewValue = true;
  }

  const nowIso = new Date().toISOString();
  if (!next.first_touch_at) {
    next.first_touch_at = nowIso;
  }
  if (hasNewValue) {
    next.last_touch_at = nowIso;
  }

  return next;
};

export const getPersistedUtm = (): UtmContext => {
  return readStorage() || readCookie() || {};
};

export const persistUtmFromParams = (params: URLSearchParams | null | undefined, referrer?: string | null) => {
  if (!params || (typeof params.size === 'number' && params.size === 0)) return;
  const input: Record<string, string> = {};
  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) input[key] = value;
  });
  if (referrer) input.referrer = referrer;
  persistUtmContext(input);
};

export const persistUtmContext = (ctx: Partial<UtmContext>) => {
  if (!isBrowser()) return;
  const incoming = pickUtmFromObject(ctx as Record<string, unknown>);
  if (!Object.keys(incoming).length) return;
  const merged = mergeContexts(getPersistedUtm(), incoming);
  writeStorage(merged);
  writeCookie(merged);
};

export const appendUtmToUrl = (
  url: string,
  overrides: Partial<UtmContext> = {},
  base: UtmContext | null = null,
) => {
  const utm = base ?? getPersistedUtm();
  const input: UtmContext = { ...utm, ...overrides };

  const [pathWithQuery = '', hash = ''] = url.split('#');
  const [path, queryString = ''] = pathWithQuery.split('?');
  const search = new URLSearchParams(queryString);

  UTM_KEYS.forEach((key) => {
    const value = input[key];
    if (value) {
      search.set(key, value);
    }
  });

  const finalQuery = search.toString();
  const rebuilt = finalQuery ? `${path}?${finalQuery}` : path;
  return hash ? `${rebuilt}#${hash}` : rebuilt;
};

export const clearUtmContext = () => {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  document.cookie = `${COOKIE_KEY}=;Path=/;Max-Age=0;SameSite=Lax`;
};

export type ServerUtmContext = UtmContext;
