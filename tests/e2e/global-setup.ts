import { request, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { loginByRequestCredentials } from './auth/loginByRequest';

export default async function globalSetup(_config: FullConfig) {
  const projectBaseURL = _config.projects?.[0]?.use?.baseURL;
  const baseURL =
    process.env.E2E_BASE_URL ??
    (typeof projectBaseURL === 'string' ? projectBaseURL : 'http://localhost:3000');
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing E2E_EMAIL/E2E_PASSWORD env vars.');
  }

  const authDir = path.join(process.cwd(), 'playwright', '.auth');
  const storagePath = path.join(authDir, 'user.json');
  fs.mkdirSync(authDir, { recursive: true });

  const context = await request.newContext({ baseURL });

  await loginByRequestCredentials(context, {
    baseURL,
    email,
    password,
    callbackPath: '/dashboard/chat',
  });

  await context.storageState({ path: storagePath });
  await context.dispose();
}
