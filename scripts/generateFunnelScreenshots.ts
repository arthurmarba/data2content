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

function generateHtml(step: number): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Data2Content - Funil Assinatura Mobile</title>
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
    }

    .mobile-container {
      width: 100%;
      max-width: 390px;
      margin: 0 auto;
      min-height: 844px;
      background: #f1ebe1;
      position: relative;
      padding: 0 14px 80px 14px;
    }

    /* iOS Status Bar simulation */
    .status-bar {
      height: 44px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 8px;
      font-size: 14px;
      font-weight: 700;
      color: #17140f;
      letter-spacing: -0.02em;
    }

    .status-bar-icons {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    /* Bottom Navigation TabBar */
    .tab-bar {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 390px;
      height: 68px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(18, 16, 20, 0.08);
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding-bottom: 10px;
      z-index: 100;
    }

    .tab-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      font-weight: 600;
      color: #6b6157;
      text-decoration: none;
      cursor: pointer;
    }

    .tab-item.active {
      color: #e90f4f;
    }

    .tab-item svg {
      width: 22px;
      height: 22px;
    }

    /* Touch Indicator / Callout Badge */
    .touch-target-indicator {
      position: relative;
    }

    .touch-pointer {
      position: absolute;
      z-index: 60;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #17140f;
      color: #fff;
      padding: 6px 14px 6px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: -0.01em;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35), 0 0 0 2px #fa165b;
      pointer-events: none;
      white-space: nowrap;
    }

    .touch-pointer::after {
      content: '';
      position: absolute;
      border: 6px solid transparent;
    }

    .touch-pointer.pointing-down {
      bottom: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%);
    }
    .touch-pointer.pointing-down::after {
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-top-color: #17140f;
    }

    .touch-pointer.pointing-up {
      top: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%);
    }
    .touch-pointer.pointing-up::after {
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-bottom-color: #17140f;
    }

    .touch-pointer .finger-icon {
      font-size: 16px;
      line-height: 1;
    }

    .touch-highlight-ring {
      box-shadow: 0 0 0 3px #fa165b, 0 0 0 7px rgba(250, 22, 91, 0.25) !important;
      position: relative;
    }

    /* Modal Backdrop */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(18, 16, 20, 0.65);
      backdrop-filter: blur(8px);
      z-index: 200;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .modal-sheet {
      width: 100%;
      max-width: 390px;
      background: #ffffff;
      border-radius: 24px 24px 0 0;
      overflow: hidden;
      max-height: 94vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.28);
    }

    .modal-header {
      padding: 18px 18px 10px 18px;
      background: #ffffff;
      border-bottom: 1px solid rgba(18, 16, 20, 0.06);
    }

    .modal-content {
      padding: 16px 18px;
      overflow-y: auto;
      flex: 1;
    }

    .modal-footer {
      padding: 12px 18px 22px 18px;
      background: #ffffff;
      border-top: 1px solid rgba(18, 16, 20, 0.06);
    }

    /* Step Banner Top Header */
    .step-banner {
      background: #17140f;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 8px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
      font-weight: 700;
    }
    .step-banner-pill {
      background: #e90f4f;
      color: #ffffff;
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  </style>
</head>
<body class="d2c-mobile-app ds-notebook">
  <div class="mobile-container">
    <!-- iOS Status Bar -->
    <div class="status-bar">
      <span>09:41</span>
      <div class="status-bar-icons">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><path d="M1 9.5h2v-2H1v2zm4 0h2v-4H5v4zm4 0h2v-6H9v6zm4 0h2v-8h-2v8z"/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 2C4.5 2 1.9 3.3 0 5.4l7.5 9.1 7.5-9.1C13.1 3.3 10.5 2 7.5 2z"/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11" fill="currentColor"><rect x="1" y="1" width="20" height="9" rx="3" fill="none" stroke="currentColor" stroke-width="1"/><rect x="3" y="3" width="13" height="5" rx="1.5"/><path d="M22 4v3" stroke="currentColor" stroke-width="1"/></svg>
      </div>
    </div>

    <!-- Banner da Etapa -->
    <div class="step-banner">
      <span>
        ${step === 1 ? 'Etapa 1: Onde assinar no perfil' : ''}
        ${step === 2 ? 'Etapa 2: Modal de assinatura sem cupom' : ''}
        ${step === 3 ? 'Etapa 3: Modal com cupom d2cVIP aplicado' : ''}
        ${step === 4 ? 'Etapa 4: Onde entrar na comunidade WhatsApp' : ''}
        ${step === 5 ? 'Etapa 5: Onde conectar o Instagram' : ''}
      </span>
      <span class="step-banner-pill">Funil d2cVIP</span>
    </div>

    <!-- Perfil Section -->
    <section class="ds-notebook-section ds-notebook-section--first" style="margin-bottom: 8px; padding: 14px 16px;">
      <div class="ds-profile-identity" style="display: flex; align-items: center; gap: 12px;">
        <div class="ds-profile-avatar" style="width: 58px; height: 58px; border-radius: 50%; overflow: hidden; background: #efe9e0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22px; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">
          ${arthurPhotoBase64 ? `<img src="${arthurPhotoBase64}" style="width: 100%; height: 100%; object-fit: cover;" alt="Arthur Marba">` : 'A'}
        </div>
        <div style="flex: 1; min-width: 0;">
          <h1 style="font-family: var(--font-d2c-display); font-size: 19px; font-weight: 800; color: #17140f; line-height: 1.15; letter-spacing: -0.03em;">Arthur Marba</h1>
          <p style="font-size: 12px; color: #6b6157; margin-top: 2px; font-weight: 500;">Olá, Arthur · <span style="display: inline-block; background: #efe9e0; color: #423b33; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; text-transform: uppercase;">Free</span></p>
        </div>
        <button type="button" style="width: 34px; height: 34px; border-radius: 50%; background: #efe9e0; border: 0; display: grid; place-items: center; color: #17140f;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 20.83V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9 1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/></svg>
        </button>
      </div>

      <div style="height: 1px; background: #e7e1d8; margin: 12px 0;"></div>

      <span class="ds-notebook-label" style="font-size: 11px;">Seu mapa</span>
      <blockquote style="font-family: var(--font-d2c-display); font-size: 18px; font-weight: 700; line-height: 1.18; color: #17140f; margin-top: 6px; letter-spacing: -0.025em;">
        “Construir uma autoridade autêntica em negócios digitais e produtos de tecnologia.”
      </blockquote>

      <div style="margin-top: 10px;">
        <span class="ds-notebook-label" style="font-size: 11px;">Assuntos</span>
        <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px;">
          <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 3px 8px; border-radius: 6px; font-size: 11.5px;">Estratégia</span>
          <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 3px 8px; border-radius: 6px; font-size: 11.5px;">Growth</span>
          <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 3px 8px; border-radius: 6px; font-size: 11.5px;">Tecnologia</span>
          <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 3px 8px; border-radius: 6px; font-size: 11.5px;">Monetização</span>
          <span class="ds-notebook-tag" style="background: #efe9e0; color: #17140f; font-weight: 600; padding: 3px 8px; border-radius: 6px; font-size: 11.5px;">Branding</span>
        </div>
      </div>
    </section>

    <!-- ETAPA 1: Card de Ativação / Onde assinar -->
    <section id="pro-activation" class="ds-notebook-section ${step === 1 ? 'touch-target-indicator' : ''}" style="margin-bottom: 8px; background: #ffffff; border: 1px solid #e7e1d8; border-radius: 16px; padding: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span class="ds-notebook-label" style="color: #e90f4f; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;">Seu mapa começou</span>
        <span style="background: #fdecf1; color: #c70a42; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 999px;">Assinatura Pro</span>
      </div>
      <h2 style="font-family: var(--font-d2c-display); font-size: 17.5px; font-weight: 800; line-height: 1.15; color: #17140f; margin-top: 6px; letter-spacing: -0.03em;">
        Seu mapa tomou forma. Agora ele pode evoluir com você.
      </h2>
      <p class="ds-body" style="font-size: 12.5px; line-height: 1.45; color: #423b33; margin-top: 6px;">
        No Pro, a D2C cruza seu Norte, seus conteúdos e o Instagram para transformar o mapa em relatório, pautas e direção prática toda semana.
      </p>

      <div style="position: relative; margin-top: 12px;">
        <button type="button" class="ds-button ds-button--primary ${step === 1 ? 'touch-highlight-ring' : ''}" style="width: 100%; min-height: 46px; border-radius: 999px; background: #e90f4f; color: #ffffff; font-weight: 700; font-size: 13.5px; border: 0; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: 0 6px 18px rgba(233, 15, 79, 0.25);">
          <span>Assinar o Pro</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>

        ${step === 1 ? `
        <div class="touch-pointer pointing-down">
          <span class="finger-icon">👉</span>
          <span>1. Toque aqui para assinar o Pro</span>
        </div>
        ` : ''}
      </div>
      <p class="ds-caption" style="font-size: 11px; text-align: center; color: #6b6157; margin-top: 6px;">Você pode continuar explorando seu mapa gratuitamente.</p>
    </section>

    <!-- ETAPA 4: Comunidade D2C no WhatsApp -->
    <section id="community-d2c" class="ds-notebook-section ${step === 4 ? 'touch-target-indicator' : ''}" style="margin-bottom: 8px; background: #ffffff; border: 1px solid #e7e1d8; border-radius: 16px; padding: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span class="ds-notebook-label" style="color: #6b6157; font-size: 11px; font-weight: 700;">Comunidade D2C no WhatsApp</span>
        <span style="background: #e7f6ef; color: #167a55; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px;">WhatsApp VIP</span>
      </div>
      <h2 style="font-family: var(--font-d2c-display); font-size: 17.5px; font-weight: 800; line-height: 1.15; color: #17140f; margin-top: 6px; letter-spacing: -0.03em;">
        Networking e comunicação diária
      </h2>
      <p class="ds-body" style="font-size: 12.5px; line-height: 1.45; color: #423b33; margin-top: 6px;">
        É por lá que criadores trocam experiências e recebem os avisos das reuniões semanais. Nas reuniões, a D2C analisa perfis e relatórios individualmente.
      </p>
      <p class="ds-caption" style="font-size: 11.5px; font-weight: 600; color: #167a55; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
        <span style="width: 6px; height: 6px; border-radius: 50%; background: #167a55; display: inline-block;"></span>
        Próxima reunião · Quinta-feira, às 19h
      </p>
      <div style="position: relative; margin-top: 12px;">
        <button type="button" class="ds-button ${step === 4 ? 'ds-button--primary touch-highlight-ring' : 'ds-button--quiet'}" style="width: 100%; min-height: 44px; border-radius: 999px; background: ${step === 4 ? '#e90f4f' : '#efe9e0'}; color: ${step === 4 ? '#ffffff' : '#17140f'}; font-weight: 700; font-size: 13px; border: 0; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: ${step === 4 ? '0 6px 18px rgba(233, 15, 79, 0.25)' : 'none'};">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.27-2.42 5.82a8.19 8.19 0 0 1-5.82 2.42c-1.48 0-2.93-.39-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.188 8.188 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24z"/></svg>
          <span>Entrar no WhatsApp</span>
        </button>

        ${step === 4 ? `
        <div class="touch-pointer pointing-down">
          <span class="finger-icon">👉</span>
          <span>4. Toque aqui para entrar na Comunidade WhatsApp</span>
        </div>
        ` : ''}
      </div>
    </section>

    <!-- ETAPA 5: Conectar Instagram no Relatório -->
    <section id="weekly-report" class="ds-notebook-section ${step === 5 ? 'touch-target-indicator' : ''}" style="margin-bottom: 8px; background: #ffffff; border: 1px solid #e7e1d8; border-radius: 16px; padding: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span class="ds-notebook-label" style="color: #6b6157; font-size: 11px; font-weight: 700;">Seu relatório</span>
        <span style="background: #efe9e0; color: #6b6157; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px;">Dados de exemplo</span>
      </div>
      <h2 style="font-family: var(--font-d2c-display); font-size: 17.5px; font-weight: 800; line-height: 1.15; color: #17140f; margin-top: 6px; letter-spacing: -0.03em;">
        A semana por dentro
      </h2>

      <!-- Banner de dados de exemplo com CTA do Instagram -->
      <div style="background: #faf8f5; border-left: 3px solid #e90f4f; padding: 10px 12px; border-radius: 0 8px 8px 0; margin-top: 10px;">
        <p style="font-size: 12px; line-height: 1.4; color: #423b33;">
          <strong style="color: #17140f;">Você está vendo dados de exemplo.</strong> Eles mostram como o relatório será organizado. Conecte o Instagram para ver os resultados do seu perfil e deixá-lo disponível para análises individuais.
        </p>

        <div style="position: relative; margin-top: 10px;">
          <button type="button" class="ds-button ds-button--primary ${step === 5 ? 'touch-highlight-ring' : ''}" style="width: 100%; min-height: 42px; border-radius: 999px; background: #e90f4f; color: #ffffff; font-weight: 700; font-size: 13px; border: 0; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(233, 15, 79, 0.25);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            <span>Conectar Instagram</span>
          </button>

          ${step === 5 ? `
          <div class="touch-pointer pointing-down">
            <span class="finger-icon">👉</span>
            <span>5. Toque aqui para conectar o Instagram</span>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- Resumo de Métricas Demo -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 12px; padding: 10px 0; border-top: 1px solid #e7e1d8; text-align: center;">
        <div>
          <b style="display: block; font-size: 17px; font-weight: 800; color: #17140f;">14.2k</b>
          <span style="font-size: 10.5px; color: #6b6157;">alcance</span>
        </div>
        <div style="border-left: 1px solid #e7e1d8; border-right: 1px solid #e7e1d8;">
          <b style="display: block; font-size: 17px; font-weight: 800; color: #17140f;">+32%</b>
          <span style="font-size: 10.5px; color: #167a55; font-weight: 600;">salvos</span>
        </div>
        <div>
          <b style="display: block; font-size: 17px; font-weight: 800; color: #17140f;">3</b>
          <span style="font-size: 10.5px; color: #6b6157;">vídeos</span>
        </div>
      </div>
    </section>

    <!-- Bottom Tab Bar -->
    <div class="tab-bar">
      <div class="tab-item active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Perfil</span>
      </div>
      <div class="tab-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Collabs</span>
      </div>
    </div>

    <!-- MODAL DE ASSINATURA (Passos 2 e 3) -->
    ${(step === 2 || step === 3) ? `
    <div class="modal-overlay">
      <div class="modal-sheet">
        <!-- Header -->
        <div class="modal-header">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="color: #e90f4f; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;">Data2Content Pro</span>
            <button type="button" style="width: 30px; height: 30px; border-radius: 50%; background: #efe9e0; border: 0; display: grid; place-items: center; color: #17140f; font-size: 15px; font-weight: 700;">✕</button>
          </div>
          <h2 style="font-family: var(--font-d2c-display); font-size: 21px; font-weight: 800; line-height: 1.05; color: #17140f; margin-top: 6px; letter-spacing: -0.04em;">
            Seu conteúdo com direção, toda semana.
          </h2>
          <p style="font-size: 12px; color: #6b6157; margin-top: 3px; line-height: 1.35;">
            O Pro mostra o que está mudando, ajuda você a interpretar os sinais e entrega as ferramentas para agir.
          </p>
        </div>

        <!-- Body -->
        <div class="modal-content">
          <!-- Benefícios -->
          <ul style="list-style: none; display: grid; gap: 7px;">
            <li style="display: flex; align-items: flex-start; gap: 7px; font-size: 12px; font-weight: 600; color: #17140f;">
              <span style="color: #e90f4f; font-weight: 800; font-size: 13px;">✓</span>
              <span>Tendências e referências novas toda semana</span>
            </li>
            <li style="display: flex; align-items: flex-start; gap: 7px; font-size: 12px; font-weight: 600; color: #17140f;">
              <span style="color: #e90f4f; font-weight: 800; font-size: 13px;">✓</span>
              <span>Reunião ao vivo com análise e direção</span>
            </li>
            <li style="display: flex; align-items: flex-start; gap: 7px; font-size: 12px; font-weight: 600; color: #17140f;">
              <span style="color: #e90f4f; font-weight: 800; font-size: 13px;">✓</span>
              <span>Mapa, pautas, collabs e ferramentas comerciais</span>
            </li>
          </ul>

          <!-- Preço -->
          <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e7e1d8;">
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <div style="display: flex; align-items: baseline; gap: 5px;">
                <span style="font-family: var(--font-d2c-display); font-size: 34px; font-weight: 800; color: #17140f; letter-spacing: -0.05em; line-height: 1;">
                  ${step === 3 ? 'R$ 0,00' : 'R$ 97,00'}
                </span>
                <span style="font-size: 11.5px; font-weight: 700; color: ${step === 3 ? '#e90f4f' : '#6b6157'};">
                  ${step === 3 ? 'no 1º mês' : '/mês'}
                </span>
              </div>
              <span style="font-size: 10.5px; font-weight: 600; color: #6b6157;">BRL (R$)</span>
            </div>

            <div style="font-size: 11px; color: ${step === 3 ? '#e90f4f' : '#6b6157'}; font-weight: ${step === 3 ? '600' : '500'}; margin-top: 3px;">
              ${step === 3 ? 'Depois, R$ 97,00/mês. Cancele quando quiser.' : 'Cobrança mensal. Cancele quando quiser.'}
            </div>

            <!-- Seletor de período -->
            <div style="display: inline-flex; background: #efe9e0; padding: 2px; border-radius: 999px; margin-top: 10px;">
              <button type="button" style="background: #ffffff; color: #17140f; font-size: 10.5px; font-weight: 700; padding: 4px 12px; border-radius: 999px; border: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">Mensal</button>
              <button type="button" style="background: transparent; color: #6b6157; font-size: 10.5px; font-weight: 600; padding: 4px 12px; border-radius: 999px; border: 0;">Anual −20%</button>
            </div>
          </div>

          <!-- Campo de Cupom -->
          <div style="margin-top: 14px; position: relative;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #17140f; margin-bottom: 5px;">
              Tem um cupom?
            </label>
            <div style="display: flex; gap: 6px;">
              <input type="text" value="${step === 3 ? 'd2cVIP' : ''}" placeholder="Digite o código" style="flex: 1; min-height: 38px; border-radius: 8px; border: ${step === 3 ? '1.5px solid #167a55' : '1px solid #e7e1d8'}; background: ${step === 3 ? '#e7f6ef' : '#efe9e0'}; padding: 0 10px; font-size: 12.5px; font-weight: 700; color: #17140f; outline: none;">
              <button type="button" style="min-height: 38px; padding: 0 12px; border-radius: 8px; border: 0; background: ${step === 3 ? '#167a55' : '#17140f'}; color: #ffffff; font-size: 11.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                ${step === 3 ? '✓ Aplicado' : 'Aplicar'}
              </button>
            </div>

            ${step === 3 ? `
            <div style="margin-top: 5px; display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #167a55;">
              <span>✓ Cupom de 100% OFF aplicado no 1º mês!</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Footer do Modal -->
        <div class="modal-footer">
          <div style="position: relative;">
            <button type="button" class="ds-button ds-button--primary" style="width: 100%; min-height: 46px; border-radius: 999px; background: #e90f4f; color: #ffffff; font-weight: 800; font-size: 13.5px; border: 0; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: 0 6px 20px rgba(233, 15, 79, 0.3);">
              <span>${step === 3 ? 'Começar meu mês grátis' : 'Assinar o Pro'}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>

            ${step === 3 ? `
            <div class="touch-pointer pointing-down">
              <span class="finger-icon">👉</span>
              <span>3. Toque para iniciar o mês grátis</span>
            </div>
            ` : step === 2 ? `
            <div class="touch-pointer pointing-down">
              <span class="finger-icon">👉</span>
              <span>2. Modal padrão sem cupom</span>
            </div>
            ` : ''}
          </div>

          <p style="font-size: 10.5px; text-align: center; color: #6b6157; margin-top: 8px; line-height: 1.35;">
            ${step === 3 ? 'Cadastre seu cartão agora. A primeira cobrança será feita somente após o primeiro mês.' : 'Pagamento 100% seguro. Cancele quando quiser.'}
          </p>
        </div>
      </div>
    </div>
    ` : ''}

  </div>
</body>
</html>`;
}

async function captureFunnelScreenshots() {
  console.log("Iniciando Playwright para captura das 5 etapas do funil mobile...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, // Retina 2x
    isMobile: true,
    hasTouch: true,
  });

  const steps = [
    {
      step: 1,
      filename: "etapa-1-perfil-onde-assinar.png",
      title: "1 - Página de Perfil: Onde tocar para assinar",
      scrollTo: null // Exibe o topo com avatar, identidade e o card de assinatura
    },
    {
      step: 2,
      filename: "etapa-2-modal-sem-cupom.png",
      title: "2 - Modal de Assinatura: Sem cupom aplicado",
      scrollTo: null
    },
    {
      step: 3,
      filename: "etapa-3-modal-com-cupom-d2cVip.png",
      title: "3 - Modal de Assinatura: Com cupom d2cVIP aplicado (R$ 0 no 1º mês)",
      scrollTo: null
    },
    {
      step: 4,
      filename: "etapa-4-perfil-whatsapp-comunidade.png",
      title: "4 - Página de Perfil: Onde tocar para entrar no grupo do WhatsApp",
      scrollTo: "#community-d2c"
    },
    {
      step: 5,
      filename: "etapa-5-perfil-conectar-instagram.png",
      title: "5 - Página de Perfil: Onde tocar para conectar com Instagram",
      scrollTo: "#weekly-report"
    }
  ];

  for (const item of steps) {
    const page = await context.newPage();
    const html = generateHtml(item.step);
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    if (item.scrollTo) {
      await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: "instant", block: "center" });
        }
      }, item.scrollTo);
      await page.waitForTimeout(400);
    }

    const publicPath = path.join(PUBLIC_DIR, item.filename);
    const artifactPath = path.join(ARTIFACT_DIR, item.filename);

    await page.screenshot({ path: publicPath, fullPage: false });
    await page.screenshot({ path: artifactPath, fullPage: false });

    console.log(`✓ Etapa ${item.step} capturada: ${item.filename}`);
    await page.close();
  }

  await browser.close();
  console.log("Todas as 5 capturas foram geradas com sucesso!");
}

captureFunnelScreenshots().catch((err) => {
  console.error("Erro ao gerar capturas:", err);
  process.exit(1);
});
