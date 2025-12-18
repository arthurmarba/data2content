import type { APIRequestContext } from '@playwright/test';

type LoginOptions = {
  baseURL: string;
  email: string;
  password: string;
  callbackPath?: string;
};

function formEncode(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}

export async function loginByRequestCredentials(
  request: APIRequestContext,
  opts: LoginOptions,
) {
  const callbackUrl = new URL(opts.callbackPath ?? '/dashboard/chat', opts.baseURL).toString();

  const csrfRes = await request.get('/api/auth/csrf');
  if (!csrfRes.ok()) {
    throw new Error(`CSRF failed: ${csrfRes.status()} ${await csrfRes.text()}`);
  }
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
  const csrfToken = csrfJson.csrfToken;
  if (!csrfToken) throw new Error('CSRF token missing from /api/auth/csrf response');

  const loginRes = await request.post('/api/auth/callback/credentials', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: formEncode({
      csrfToken,
      callbackUrl,
      json: 'true',
      email: opts.email,
      password: opts.password,
    }),
  });

  if (!(loginRes.ok() || loginRes.status() === 302)) {
    throw new Error(`Login failed: ${loginRes.status()} ${await loginRes.text()}`);
  }

  const sessionRes = await request.get('/api/auth/session');
  if (!sessionRes.ok()) {
    throw new Error(`Session check failed: ${sessionRes.status()} ${await sessionRes.text()}`);
  }
  const session = (await sessionRes.json()) as { user?: unknown };
  if (!session?.user) {
    throw new Error(`Not authenticated. Session payload: ${JSON.stringify(session)}`);
  }

  return session;
}
