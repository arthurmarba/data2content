import { spawnSync } from 'node:child_process';

const tag = '[playwright-install]';

if (process.env.SKIP_PLAYWRIGHT_BROWSER_DOWNLOAD === '1') {
  console.log(`${tag} SKIP_PLAYWRIGHT_BROWSER_DOWNLOAD=1, pulando instalação do Chromium.`);
  process.exit(0);
}

const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' };
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxCmd, ['playwright', 'install', 'chromium'], {
  env,
  stdio: 'inherit',
});

if (typeof result.status === 'number' && result.status !== 0) {
  console.error(`${tag} Falha ao instalar Chromium do Playwright (exit=${result.status}).`);
  process.exit(result.status);
}

if (result.error) {
  console.error(`${tag} Erro ao executar install:`, result.error);
  process.exit(1);
}

console.log(`${tag} Chromium do Playwright disponível em PLAYWRIGHT_BROWSERS_PATH=0.`);
