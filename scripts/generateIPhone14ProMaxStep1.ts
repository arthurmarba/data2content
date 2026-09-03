import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "/Users/arthurmarba/.gemini/antigravity/brain/93ec3c58-2f8b-4b4c-bc90-415c4165596e";
const PUBLIC_DIR = "/Users/arthurmarba/d2c-frontend/public/images/funil-d2c";

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Arthur's photo base64
const arthurPhotoPath = "/Users/arthurmarba/d2c-frontend/public/images/landing/arthur-marba-founder-editorial-v1.webp";
const arthurPhotoBase64 = fs.existsSync(arthurPhotoPath)
  ? `data:image/webp;base64,${fs.readFileSync(arthurPhotoPath).toString("base64")}`
  : "";

const tokensCss = fs.readFileSync("/Users/arthurmarba/d2c-frontend/src/design-system/tokens.css", "utf-8");

function generateIPhone14ProMaxStep1Html(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>D2C - Perfil (iPhone 14 Pro Max)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;700;800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    ${tokensCss}

    :root {
      --font-d2c-sans: 'Instrument Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-d2c-display: 'Bricolage Grotesque', Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: #f1ebe1;
      font-family: var(--font-d2c-sans);
      color: #17140f;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
      margin: 0;
      padding: 0;
      width: 430px;
      height: 932px;
    }

    .iphone-frame {
      width: 430px;
      height: 932px;
      margin: 0 auto;
      background: #f1ebe1;
      position: relative;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      scrollbar-width: none;
    }

    .iphone-frame::-webkit-scrollbar {
      display: none;
    }

    /* iOS Status Bar with Dynamic Island */
    .status-bar-container {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      z-index: 90;
      background: #f1ebe1;
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
    }

    .status-bar-time {
      font-size: 16px;
      font-weight: 700;
      color: #17140f;
      letter-spacing: -0.02em;
      width: 60px;
    }

    .dynamic-island {
      width: 124px;
      height: 34px;
      background: #000000;
      border-radius: 20px;
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      top: 10px;
    }

    .status-bar-icons {
      display: flex;
      gap: 7px;
      align-items: center;
      justify-content: flex-end;
      width: 70px;
      color: #17140f;
    }

    /* Main Scroll Content */
    .main-content {
      flex: 1;
      padding: 4px 18px 100px 18px;
    }

    /* Bottom Navigation TabBar exactly matching DiagnosticoTabBar.tsx */
    .tab-bar {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 430px;
      height: 84px;
      background: #f1ebe1;
      border-top: 1px solid rgba(18, 16, 20, 0.12);
      display: flex;
      justify-content: space-around;
      align-items: flex-start;
      padding-top: 8px;
      padding-bottom: 24px;
      z-index: 100;
    }

    .tab-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 3px;
      background: transparent;
      border: 0;
      cursor: pointer;
      color: #6b6157;
      min-width: 68px;
    }

    .tab-btn.active {
      color: #c70a42;
    }

    .tab-btn .tab-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 28px;
    }

    .tab-btn .tab-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: -0.1px;
    }

    /* Central '+' Button */
    .plus-action-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 3px;
      min-width: 68px;
    }

    .plus-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #fa165b;
      color: #ffffff;
      display: grid;
      place-items: center;
      border: 1px solid #ffffff;
      box-shadow: 0 4px 14px rgba(250, 22, 91, 0.35);
      cursor: pointer;
    }

    .plus-label {
      font-size: 11px;
      font-weight: 700;
      color: #c70a42;
      letter-spacing: -0.1px;
    }

    /* Home indicator */
    .home-indicator {
      position: fixed;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 140px;
      height: 5px;
      background: rgba(18, 16, 20, 0.35);
      border-radius: 100px;
      z-index: 110;
      pointer-events: none;
    }

    /* Touch Pointer Callout */
    .touch-pointer {
      position: absolute;
      z-index: 60;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #17140f;
      color: #ffffff;
      padding: 7px 16px 7px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: -0.01em;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 0 2px #fa165b;
      pointer-events: none;
      white-space: nowrap;
      bottom: calc(100% + 12px);
      left: 50%;
      transform: translateX(-50%);
    }

    .touch-pointer::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 7px solid transparent;
      border-top-color: #17140f;
    }

    .touch-highlight-ring {
      box-shadow: 0 0 0 3px #fa165b, 0 0 0 8px rgba(250, 22, 91, 0.25) !important;
    }
  </style>
</head>
<body class="d2c-mobile-app ds-notebook">
  <div class="iphone-frame">
    <!-- Status Bar with Dynamic Island -->
    <div class="status-bar-container">
      <span class="status-bar-time">9:41</span>
      <div class="dynamic-island"></div>
      <div class="status-bar-icons">
        <svg width="18" height="12" viewBox="0 0 17 11" fill="currentColor"><path d="M1 9.5h2v-2H1v2zm4 0h2v-4H5v4zm4 0h2v-6H9v6zm4 0h2v-8h-2v8z"/></svg>
        <svg width="16" height="12" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 2C4.5 2 1.9 3.3 0 5.4l7.5 9.1 7.5-9.1C13.1 3.3 10.5 2 7.5 2z"/></svg>
        <svg width="25" height="12" viewBox="0 0 24 11" fill="currentColor"><rect x="1" y="1" width="20" height="9" rx="3" fill="none" stroke="currentColor" stroke-width="1"/><rect x="3" y="3" width="13" height="5" rx="1.5"/><path d="M22 4v3" stroke="currentColor" stroke-width="1"/></svg>
      </div>
    </div>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Perfil / Identidade & Mapa -->
      <section class="ds-notebook-section ds-notebook-section--first" style="margin-bottom: 10px; padding: 18px 20px; background: #ffffff; border-radius: 18px;">
        <div class="ds-profile-identity" style="display: flex; align-items: center; gap: 14px;">
          <div class="ds-profile-avatar" style="width: 68px; height: 68px; border-radius: 50%; overflow: hidden; background: #efe9e0; flex-shrink: 0; border: 2.5px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.08);">
            <img src="${arthurPhotoBase64}" style="width: 100%; height: 100%; object-fit: cover; object-position: center 12%;" alt="Arthur Marba">
          </div>
          <div style="flex: 1; min-width: 0;">
            <h1 style="font-family: var(--font-d2c-display); font-size: 21px; font-weight: 800; color: #17140f; line-height: 1.15; letter-spacing: -0.03em;">Arthur Marba</h1>
            <p style="font-size: 13px; color: #6b6157; margin-top: 3px; font-weight: 500;">Olá, Arthur</p>
          </div>
          <button type="button" style="width: 38px; height: 38px; border-radius: 50%; background: #efe9e0; border: 0; display: grid; place-items: center; color: #17140f;" aria-label="Configurações">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 20.83V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9 1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/></svg>
          </button>
        </div>

        <div style="height: 1px; background: #e7e1d8; margin: 16px 0;"></div>

        <span class="ds-notebook-label" style="font-size: 11.5px;">Seu mapa</span>
        <blockquote style="font-family: var(--font-d2c-display); font-size: 21px; font-weight: 700; line-height: 1.15; color: #17140f; margin-top: 6px; letter-spacing: -0.025em;">
          “Construir uma autoridade autêntica em negócios digitais e produtos de tecnologia.”
        </blockquote>

        <div style="margin-top: 14px;">
          <span class="ds-notebook-label" style="font-size: 11.5px;">Assuntos</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
            <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 4px 10px; border-radius: 6px; font-size: 12px;">Estratégia</span>
            <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 4px 10px; border-radius: 6px; font-size: 12px;">Growth</span>
            <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 4px 10px; border-radius: 6px; font-size: 12px;">Tecnologia</span>
            <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 4px 10px; border-radius: 6px; font-size: 12px;">Monetização</span>
            <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 4px 10px; border-radius: 6px; font-size: 12px;">Branding</span>
          </div>
          <p class="ds-caption" style="margin-top: 10px; font-size: 11.5px; color: #6b6157;">Isso é o que você escreveu ao criar a conta. Nenhum vídeo publicado confirmou esses assuntos ainda.</p>
          <button type="button" class="ds-notebook-action" style="display: flex; justify-content: space-between; align-items: center; width: 100%; border: 0; background: transparent; padding: 12px 0 2px 0; font-size: 13px; font-weight: 700; color: #17140f; cursor: pointer;">
            <span>Ver mapa completo</span>
            <span style="color: #6b6157; font-size: 16px;">›</span>
          </button>
        </div>
      </section>

      <!-- Card de Ativação / Onde assinar o Pro -->
      <section id="pro-activation" class="ds-notebook-section" style="margin-bottom: 10px; background: #ffffff; border: 1px solid #e7e1d8; border-radius: 18px; padding: 18px 20px;">
        <span class="ds-notebook-label" style="color: #6b6157; font-size: 11.5px; font-weight: 700;">Seu mapa começou</span>
        <h2 style="font-family: var(--font-d2c-display); font-size: 19px; font-weight: 800; line-height: 1.15; color: #17140f; margin-top: 6px; letter-spacing: -0.03em;">
          Seu mapa tomou forma. Agora ele pode evoluir com você.
        </h2>
        <p class="ds-body" style="font-size: 13px; line-height: 1.5; color: #423b33; margin-top: 8px;">
          No Pro, a D2C cruza seu Norte, seus conteúdos e o Instagram para transformar o mapa em relatório, pautas e direção prática toda semana.
        </p>

        <!-- Botão CTA com Touch Indicator -->
        <div style="position: relative; margin-top: 16px;">
          <div class="touch-pointer">
            <span class="finger-icon">👉</span>
            <span>1. Toque aqui para assinar o Pro</span>
          </div>

          <button type="button" class="ds-button ds-button--primary touch-highlight-ring" style="width: 100%; min-height: 50px; border-radius: 999px; background: #fa165b; color: #ffffff; font-weight: 750; font-size: 14.5px; border: 0; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: 0 8px 24px rgba(250, 22, 91, 0.3);">
            <span>Assinar o Pro</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>

        <p class="ds-caption" style="font-size: 11.5px; text-align: center; color: #6b6157; margin-top: 8px;">Você pode continuar explorando seu mapa gratuitamente.</p>
      </section>

      <!-- Comunidade D2C no WhatsApp -->
      <section id="community-d2c" class="ds-notebook-section" style="margin-bottom: 10px; background: #ffffff; border: 1px solid #e7e1d8; border-radius: 18px; padding: 18px 20px;">
        <span class="ds-notebook-label" style="color: #6b6157; font-size: 11.5px; font-weight: 700;">Comunidade D2C no WhatsApp</span>
        <h2 style="font-family: var(--font-d2c-display); font-size: 19px; font-weight: 800; line-height: 1.15; color: #17140f; margin-top: 6px; letter-spacing: -0.03em;">
          Networking e comunicação diária
        </h2>
        <p class="ds-body" style="font-size: 13px; line-height: 1.5; color: #423b33; margin-top: 8px;">
          É por lá que criadores trocam experiências e recebem os avisos das reuniões semanais.
        </p>
        <p class="ds-caption" style="font-size: 12px; font-weight: 600; color: #167a55; margin-top: 8px;">
          Próxima reunião · Quinta-feira, às 19h
        </p>
        <div style="margin-top: 14px;">
          <button type="button" class="ds-button ds-button--quiet" style="min-height: 42px; border-radius: 999px; background: #efe9e0; color: #17140f; font-weight: 700; font-size: 13px; border: 0; padding: 0 18px; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.27-2.42 5.82a8.19 8.19 0 0 1-5.82 2.42c-1.48 0-2.93-.39-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.188 8.188 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24z"/></svg>
            <span>Entrar no WhatsApp</span>
          </button>
        </div>
      </section>
    </main>

    <!-- Bottom Navigation Bar (DiagnosticoTabBar: Perfil | + Analisar | Collabs) -->
    <nav class="tab-bar">
      <button type="button" class="tab-btn active">
        <span class="tab-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" stroke-linecap="round"/></svg>
        </span>
        <span class="tab-label">Perfil</span>
      </button>

      <div class="plus-action-slot">
        <button type="button" class="plus-btn" aria-label="Analisar conteúdo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <span class="plus-label">Analisar</span>
      </div>

      <button type="button" class="tab-btn">
        <span class="tab-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9.5" r="2.4"/><path d="M3 19c0-2.8 2.5-4.7 5.5-4.7 1.6 0 3 .55 4 1.45" stroke-linecap="round"/><path d="M14 18.8c.3-2.2 2.1-3.6 4.4-3.6 1.5 0 2.8.6 3.6 1.6" stroke-linecap="round"/></svg>
        </span>
        <span class="tab-label">Collabs</span>
      </button>
    </nav>

    <!-- Home Indicator -->
    <div class="home-indicator"></div>
  </div>
</body>
</html>`;
}

async function captureIPhone14ProMaxStep1() {
  console.log("Iniciando captura iPhone 14 Pro Max da Etapa 1...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3, // Retina 3x para iPhone 14 Pro Max
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  const html = generateIPhone14ProMaxStep1Html();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const filename = "etapa-1-perfil-iphone-14-pro-max.png";
  const publicPath = path.join(PUBLIC_DIR, filename);
  const artifactPath = path.join(ARTIFACT_DIR, filename);

  await page.screenshot({ path: publicPath, fullPage: false });
  await page.screenshot({ path: artifactPath, fullPage: false });

  console.log(`✓ Etapa 1 capturada com sucesso para iPhone 14 Pro Max: ${filename}`);

  await browser.close();
}

captureIPhone14ProMaxStep1().catch((err) => {
  console.error("Erro ao gerar captura:", err);
  process.exit(1);
});
