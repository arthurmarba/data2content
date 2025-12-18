import { chromium, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loginByRequestCredentials } from './auth/loginByRequest';

export default async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing E2E_EMAIL/E2E_PASSWORD env vars.');
  }

  const authDir = path.join(process.cwd(), 'playwright', '.auth');
  const storagePath = path.join(authDir, 'user.json');
  fs.mkdirSync(authDir, { recursive: true });

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_BIN;
  const launchArgs = process.env.PLAYWRIGHT_EXTRA_ARGS
    ? process.env.PLAYWRIGHT_EXTRA_ARGS.split(/\s+/).filter(Boolean)
    : [
        '--disable-crash-reporter',
        '--disable-features=Crashpad',
      ];

  const browser = await chromium.launch(
    executablePath
      ? { executablePath, args: launchArgs }
      : { args: launchArgs }
  );
  const context = await browser.newContext({ baseURL });

  await loginByRequestCredentials(context.request, {
    baseURL,
    email,
    password,
    callbackPath: '/dashboard/chat',
  });

  await context.storageState({ path: storagePath });

  await context.close();
  await browser.close();
}
