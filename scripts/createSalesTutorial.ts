import { createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";

import OpenAI from "openai";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";

import {
  getSalesTutorialStoryboard,
  type StoryboardStep,
  type TutorialMode,
} from "./salesTutorial/storyboard";

type CliOptions = {
  mode: TutorialMode;
  baseUrl: string;
  outputRoot: string;
  storageStatePath: string | null;
  campaignsStorageStatePath: string | null;
  publisStorageStatePath: string | null;
  voice: string;
  startServer: boolean;
  headed: boolean;
  skipTts: boolean;
  skipMerge: boolean;
};

type TimelineEntry = {
  id: string;
  title: string;
  route: string;
  narration: string;
  startedAtMs: number;
  endedAtMs: number;
  requiresAuth: boolean;
};

type NarrationSegment = {
  stepId: string;
  title: string;
  narration: string;
  filePath: string;
  durationMs: number;
};

type TutorialManifest = {
  requestedMode: TutorialMode;
  effectiveMode: TutorialMode;
  baseUrl: string;
  authAvailable: boolean;
  outputDir: string;
  generatedAt: string;
  startedServer: boolean;
  artifacts: {
    rawVideo: string | null;
    narrationAudio: string | null;
    finalVideo: string | null;
    contactSheet: string | null;
    captions: string;
    script: string;
  };
  steps: TimelineEntry[];
  warnings: string[];
};

type CapturedStoryboardStep = {
  id: string;
  title: string;
  route: string;
  narration: string;
  requiresAuth: boolean;
  durationMs: number;
  clipPath: string;
};

type FocusResolution = {
  matched: boolean;
  point: { x: number; y: number } | null;
  details?: string;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_OUTPUT_ROOT = "tmp/sales-tutorials";
const DEFAULT_STORAGE_STATE = "playwright/.auth/user.json";
const DEFAULT_CAMPAIGNS_STORAGE_STATE = "playwright/.auth/admin.json";
const DEFAULT_PUBLIS_STORAGE_STATE = "playwright/.auth/livia-linhares.json";
const DEFAULT_VOICE = "nova";
const VIEWPORT = { width: 1512, height: 982 };
const SERVER_TIMEOUT_MS = 180_000;
const STEP_CAPTURE_SETTLE_MS = 350;
const STEP_CAPTURE_TAIL_MS = 250;
const TUTORIAL_CAMPAIGN_ID = "tutorial-campaign-001";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function parseCli(): CliOptions {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "sales" },
      "base-url": { type: "string", default: DEFAULT_BASE_URL },
      "output-root": { type: "string", default: DEFAULT_OUTPUT_ROOT },
      "storage-state": { type: "string", default: DEFAULT_STORAGE_STATE },
      "campaigns-storage-state": { type: "string", default: DEFAULT_CAMPAIGNS_STORAGE_STATE },
      "publis-storage-state": { type: "string", default: DEFAULT_PUBLIS_STORAGE_STATE },
      voice: { type: "string", default: DEFAULT_VOICE },
      "start-server": { type: "boolean", default: false },
      headed: { type: "boolean", default: false },
      "skip-tts": { type: "boolean", default: false },
      "skip-merge": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const requestedMode = String(values.mode || "sales");
  if (!["landing", "platform", "sales"].includes(requestedMode)) {
    throw new Error(`Modo invalido: ${requestedMode}. Use landing, platform ou sales.`);
  }

  const storageStateRaw = String(values["storage-state"] || DEFAULT_STORAGE_STATE).trim();
  const campaignsStorageStateRaw = String(
    values["campaigns-storage-state"] || DEFAULT_CAMPAIGNS_STORAGE_STATE,
  ).trim();
  const publisStorageStateRaw = String(
    values["publis-storage-state"] || DEFAULT_PUBLIS_STORAGE_STATE,
  ).trim();

  return {
    mode: requestedMode as TutorialMode,
    baseUrl: String(values["base-url"] || DEFAULT_BASE_URL).trim().replace(/\/+$/, ""),
    outputRoot: String(values["output-root"] || DEFAULT_OUTPUT_ROOT).trim(),
    storageStatePath: storageStateRaw.length > 0 ? path.resolve(process.cwd(), storageStateRaw) : null,
    campaignsStorageStatePath:
      campaignsStorageStateRaw.length > 0 ? path.resolve(process.cwd(), campaignsStorageStateRaw) : null,
    publisStorageStatePath:
      publisStorageStateRaw.length > 0 ? path.resolve(process.cwd(), publisStorageStateRaw) : null,
    voice: String(values.voice || DEFAULT_VOICE).trim(),
    startServer: Boolean(values["start-server"]),
    headed: Boolean(values.headed),
    skipTts: Boolean(values["skip-tts"]),
    skipMerge: Boolean(values["skip-merge"]),
  };
}

function getTimestampLabel(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function canReach(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function waitForReachable(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canReach(url)) return;
    await sleep(1_500);
  }
  throw new Error(`A aplicacao nao respondeu em ${Math.round(timeoutMs / 1000)}s: ${url}`);
}

function getPortFromBaseUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  return parsed.port || (parsed.protocol === "https:" ? "443" : "80");
}

async function maybeStartServer(
  options: CliOptions,
  outputDir: string,
): Promise<{ process: ChildProcess | null; started: boolean }> {
  if (await canReach(options.baseUrl)) {
    return { process: null, started: false };
  }

  if (!options.startServer) {
    throw new Error(
      `Nao foi possivel acessar ${options.baseUrl}. Inicie a aplicacao ou rode com --start-server.`,
    );
  }

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const logPath = path.join(outputDir, "dev-server.log");
  const logStream = createWriteStream(logPath, { flags: "a" });
  const child = spawn(npmCmd, ["run", "dev"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: getPortFromBaseUrl(options.baseUrl),
      NEXTAUTH_URL: options.baseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);

  try {
    await waitForReachable(options.baseUrl, SERVER_TIMEOUT_MS);
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }

  return { process: child, started: true };
}

function estimateStepDurationMs(step: StoryboardStep): number {
  const words = step.narration.trim().split(/\s+/).filter(Boolean).length;
  const speechMs = Math.max(3_200, Math.round((words / 2.6) * 1000));
  return step.settleMs ?? speechMs;
}

async function waitForVisibleText(page: Page, text: string) {
  return waitForVisibleTextWithTimeout(page, text, 20_000);
}

async function waitForVisibleTextWithTimeout(page: Page, text: string, timeout: number) {
  await page.waitForFunction(
    (targetText) => {
      const normalizedTarget = String(targetText).trim().toLowerCase();
      const elements = Array.from(document.querySelectorAll("body *"));

      return elements.some((element) => {
        const htmlElement = element as HTMLElement;
        const content = (htmlElement.innerText || htmlElement.textContent || "").trim().toLowerCase();
        if (!content.includes(normalizedTarget)) return false;

        const style = window.getComputedStyle(htmlElement);
        const rect = htmlElement.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity || "1") > 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      });
    },
    text,
    { timeout },
  );
}

async function describeVisibleHeadings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("h1, h2, h3"));
    return nodes
      .map((node) => {
        const htmlElement = node as HTMLElement;
        const style = window.getComputedStyle(htmlElement);
        const rect = htmlElement.getBoundingClientRect();
        const visible =
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity || "1") > 0 &&
          rect.width > 0 &&
          rect.height > 0;
        if (!visible) return null;
        return (htmlElement.innerText || htmlElement.textContent || "").trim();
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 10);
  });
}

async function getScrollMetrics(page: Page) {
  return page.evaluate(() => ({
    scrollHeight: Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    ),
    viewportHeight: window.innerHeight,
  }));
}

async function setScrollTop(page: Page, top: number) {
  await page.evaluate((value) => {
    window.scrollTo({ top: value, behavior: "auto" });
  }, top);
}

async function dismissRecordingObstructions(page: Page) {
  const buttonNames = [/^aceitar$/i, /^accept$/i, /^entendi$/i, /^ok$/i, /^fechar$/i];

  for (const name of buttonNames) {
    const button = page.getByRole("button", { name }).first();
    const visible = await button.isVisible().catch(() => false);
    if (!visible) continue;
    await button.click({ timeout: 1_000 }).catch(() => undefined);
    await sleep(200);
  }
}

async function findVisibleSelectorCenter(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const isVisible = await locator.isVisible().catch(() => false);
    if (!isVisible) continue;

    await locator.scrollIntoViewIfNeeded().catch(() => undefined);
    const box = await locator.boundingBox().catch(() => null);
    if (box) {
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
  }

  return null;
}

async function findVisibleTextCenter(page: Page, texts: string[]) {
  for (const text of texts) {
    const point = await page.evaluate((targetText) => {
      const normalizedTarget = String(targetText).trim().toLowerCase();
      const candidates = Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const htmlElement = element as HTMLElement;
          const content = (htmlElement.innerText || htmlElement.textContent || "").trim().toLowerCase();
          if (!content.includes(normalizedTarget)) return null;

          const style = window.getComputedStyle(htmlElement);
          const rect = htmlElement.getBoundingClientRect();
          const visible =
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            Number(style.opacity || "1") > 0 &&
            rect.width > 0 &&
            rect.height > 0;

          if (!visible) return null;

          return {
            element: htmlElement,
            area: rect.width * rect.height,
            textLength: content.length,
          };
        })
        .filter(
          (
            candidate,
          ): candidate is { element: HTMLElement; area: number; textLength: number } => Boolean(candidate),
        )
        .sort((left, right) => {
          if (left.area !== right.area) return left.area - right.area;
          return left.textLength - right.textLength;
        });

      const bestCandidate = candidates[0];
      if (!bestCandidate) return null;

      bestCandidate.element.scrollIntoView({ block: "center", behavior: "smooth" });
      const updatedRect = bestCandidate.element.getBoundingClientRect();
      return {
        x: updatedRect.left + updatedRect.width / 2,
        y: updatedRect.top + updatedRect.height / 2,
      };
    }, text);

    if (point) {
      return point;
    }
  }

  return null;
}

async function resolveFocus(page: Page, step: StoryboardStep): Promise<FocusResolution> {
  const selectors = [...(step.focusSelectors ?? []), ...(step.focusSelector ? [step.focusSelector] : [])];
  const texts = [...(step.focusTexts ?? []), ...(step.focusText ? [step.focusText] : [])];

  if (!selectors.length && !texts.length) {
    if (typeof step.scrollY === "number") {
      await setScrollTop(page, Math.max(0, step.scrollY));
      await sleep(300);
    }
    return { matched: true, point: null };
  }

  const metrics = await getScrollMetrics(page);
  const positions = new Set<number>([
    0,
    typeof step.scrollY === "number" ? Math.max(0, step.scrollY) : 0,
  ]);
  const increment = Math.max(420, Math.floor(metrics.viewportHeight * 0.65));
  for (let top = 0; top < metrics.scrollHeight; top += increment) {
    positions.add(top);
  }
  positions.add(Math.max(0, metrics.scrollHeight - metrics.viewportHeight));

  const orderedPositions = Array.from(positions).sort((a, b) => a - b);
  let lastError: unknown = null;

  for (const top of orderedPositions) {
    await setScrollTop(page, top);
    await sleep(250);

    if (selectors.length) {
      const point = await findVisibleSelectorCenter(page, selectors);
      if (point) {
        return { matched: true, point };
      }
    }

    for (const text of texts) {
      try {
        await waitForVisibleTextWithTimeout(page, text, 1_200);
        const point = await findVisibleTextCenter(page, [text]);
        return { matched: true, point };
      } catch (error) {
        lastError = error;
      }
    }
  }

  const headings = await describeVisibleHeadings(page).catch(() => []);
  const details = [
    `URL atual: ${page.url()}`,
    selectors.length ? `Seletores tentados: ${selectors.join(" | ")}` : null,
    texts.length ? `Textos tentados: ${texts.join(" | ")}` : null,
    headings.length ? `Headings visiveis: ${headings.join(" || ")}` : "Headings visiveis: nenhum",
    lastError instanceof Error ? `Erro original: ${lastError.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    matched: false,
    point: null,
    details,
  };
}

async function centerFocus(page: Page, resolution: FocusResolution) {
  if (resolution.point) {
    await sleep(500);
    await page.mouse.move(resolution.point.x, resolution.point.y, { steps: 20 });
  }
}

async function injectStepOverlay(page: Page, step: StoryboardStep) {
  await page.evaluate(({ title, subtitle }) => {
    const existing = document.getElementById("sales-tutorial-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "sales-tutorial-overlay";
    overlay.setAttribute(
      "style",
      [
        "position:fixed",
        "left:32px",
        "bottom:30px",
        "z-index:2147483647",
        "pointer-events:none",
        "max-width:440px",
        "padding:16px 18px",
        "border-radius:20px",
        "background:rgba(15,23,42,0.82)",
        "backdrop-filter:blur(12px)",
        "box-shadow:0 24px 60px rgba(15,23,42,0.24)",
        "color:#fff",
        "font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      ].join(";"),
    );

    const kicker = document.createElement("div");
    kicker.textContent = "D2C Platform Tour";
    kicker.setAttribute(
      "style",
      "font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:rgba(244,114,182,0.95);margin-bottom:8px;",
    );

    const titleNode = document.createElement("div");
    titleNode.textContent = title;
    titleNode.setAttribute("style", "font-size:28px;line-height:1.02;font-weight:800;letter-spacing:-0.04em;");

    overlay.appendChild(kicker);
    overlay.appendChild(titleNode);

    if (subtitle) {
      const subtitleNode = document.createElement("div");
      subtitleNode.textContent = subtitle;
      subtitleNode.setAttribute(
        "style",
        "margin-top:8px;font-size:14px;line-height:1.45;color:rgba(255,255,255,0.82);font-weight:500;",
      );
      overlay.appendChild(subtitleNode);
    }

    document.body.appendChild(overlay);
  }, { title: step.overlayTitle ?? step.title, subtitle: step.overlaySubtitle ?? "" });
}

async function startCameraMove(page: Page, step: StoryboardStep, durationMs: number) {
  if (!step.cameraMoveY) return;

  await page.evaluate(
    ({ deltaY, duration }) => {
      const startY = window.scrollY;
      const maxTarget = Math.max(
        0,
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
        ) - window.innerHeight,
      );
      const targetY = Math.max(0, Math.min(maxTarget, startY + deltaY));
      const animationDuration = Math.max(900, Math.min(duration - 180, 3200));
      const startedAt = performance.now();

      const timer = window.setInterval(function () {
        const progress = Math.min(1, (performance.now() - startedAt) / animationDuration);
        const eased = 0.5 - Math.cos(Math.PI * progress) / 2;
        const nextY = startY + (targetY - startY) * eased;
        window.scrollTo({ top: nextY, behavior: "auto" });
        if (progress >= 1) {
          window.clearInterval(timer);
        }
      }, 16);
    },
    { deltaY: step.cameraMoveY, duration: durationMs },
  );
}

function resolveStepUrl(baseUrl: string, route: string) {
  if (/^https?:\/\//i.test(route)) return route;
  return `${baseUrl}${route}`;
}

async function fulfillJson(route: Route, body: JsonValue) {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });
}

function getTutorialCampaignListItem() {
  return {
    id: TUTORIAL_CAMPAIGN_ID,
    brandName: "Track&Glow",
    campaignTitle: "Sequencia de Reels para lancamento de linha clean beauty",
    status: "respondido",
    budget: 4800,
    budgetIntent: "provided",
    currency: "BRL",
    creatorProposedBudget: 6200,
    creatorProposedCurrency: "BRL",
    creatorProposedAt: "2026-03-08T14:30:00.000Z",
    createdAt: "2026-03-07T11:12:00.000Z",
    lastResponseAt: "2026-03-08T15:00:00.000Z",
    lastResponseMessage:
      "Consigo atender com um pacote de Reels e stories com entregas distribuidas ao longo da semana.",
  };
}

function getTutorialCampaignDetail() {
  return {
    ...getTutorialCampaignListItem(),
    contactName: "Julia Brand Manager",
    contactEmail: "julia@trackglow.com",
    contactWhatsapp: "+55 11 98888-1020",
    campaignDescription:
      "Marca de clean beauty buscando uma criadora com autoridade em rotina, tutorial e comparativos para uma campanha com foco em conversao e prova social.",
    deliverables: [
      "2 Reels com CTA para pagina da marca",
      "4 Stories com link e prova de uso",
      "1 direito de uso organico por 30 dias",
    ],
    referenceLinks: [
      "https://trackglow.com/campaign/clean-launch",
      "https://trackglow.com/brief/reel-reference",
    ],
    originIp: "127.0.0.1",
    userAgent: "Sales Tutorial Demo",
    mediaKitSlug: "livia-linhares",
    updatedAt: "2026-03-08T15:05:00.000Z",
    latestAnalysis: {
      createdAt: "2026-03-08T15:01:00.000Z",
      version: "tutorial-demo-v1",
      analysis:
        "A proposta esta acima da media usual do nicho, mas faz sentido pelo encaixe entre rotina, demostracao e autoridade. O melhor caminho e responder com escopo valorizando prova real de uso e janela de conversao.",
      replyDraft:
        "Oi, Julia! Obrigada pela proposta. Pelo escopo e pelo potencial de conversao, consigo atender com um pacote de 2 Reels e 4 Stories por R$ 6.200. Se fizer sentido, ja te devolvo cronograma e estrutura de entrega.",
      suggestionType: "ajustar",
      suggestedValue: 6200,
      pricingConsistency: "alta",
      pricingSource: "calculator_core_v1",
      limitations: [],
      analysisV2: {
        verdict: "ajustar",
        confidence: {
          score: 0.92,
          label: "alta",
        },
        pricing: {
          currency: "BRL",
          offered: 4800,
          target: 6200,
          anchor: 6800,
          floor: 5600,
          gapPercent: -22.6,
        },
        rationale: [
          "A campanha pede prova de uso real, o que combina com conteudo de rotina e tutorial.",
          "O pacote inclui multiplas entregas e direito de uso, o que justifica ajuste de valor.",
        ],
        playbook: [
          "Responder reforcando conversao, autoridade e formato de entrega.",
          "Apresentar valor alvo e, se necessario, oferecer escopo alternativo mais enxuto.",
        ],
        cautions: [
          "Evitar aceitar sem amarrar cronograma e direito de uso.",
        ],
      },
      meta: {
        model: "tutorial-demo",
        fallbackUsed: false,
        latencyMs: 420,
        contextSignals: ["clean-beauty", "tutorial", "conversao"],
      },
    },
    analysisHistory: [],
  };
}

function getTutorialCampaignLinks() {
  return {
    items: [
      {
        id: "tutorial-link-script-001",
        entityType: "script",
        entityId: "tutorial-script-001",
        scriptApprovalStatus: "approved",
        notes: "Roteiro alinhado com CTA e prova de uso.",
        createdAt: "2026-03-08T15:03:00.000Z",
        updatedAt: "2026-03-08T15:10:00.000Z",
        entity: {
          id: "tutorial-script-001",
          title: "Reel 1 · rotina glow em 30 segundos",
          subtitle: "Roteiro salvo no planner com CTA de conversao",
          coverUrl: "/images/Tutorial.png",
          detailUrl: "/planning/roteiros",
          updatedAt: "2026-03-08T14:55:00.000Z",
          postDate: null,
        },
      },
      {
        id: "tutorial-link-publi-001",
        entityType: "publi",
        entityId: "tutorial-publi-001",
        scriptApprovalStatus: null,
        notes: "Publi de referencia com resultado acima da media.",
        createdAt: "2026-03-08T15:04:00.000Z",
        updatedAt: "2026-03-08T15:04:00.000Z",
        entity: {
          id: "tutorial-publi-001",
          title: "Review rapido com prova de uso",
          subtitle: "Conteudo vinculado para comprovar resultado",
          coverUrl: "/images/Livia Foto D2C.png",
          detailUrl: "/dashboard/publis/tutorial-publi-001",
          updatedAt: "2026-03-05T18:20:00.000Z",
          postDate: "2026-03-05T18:20:00.000Z",
        },
      },
    ],
    linkableScripts: [
      {
        id: "tutorial-script-001",
        title: "Reel 1 · rotina glow em 30 segundos",
        source: "planner",
        updatedAt: "2026-03-08T14:55:00.000Z",
      },
      {
        id: "tutorial-script-002",
        title: "Stories · comparativo antes e depois",
        source: "ai",
        updatedAt: "2026-03-08T15:12:00.000Z",
      },
    ],
    linkablePublis: [
      {
        id: "tutorial-publi-001",
        description: "Review rapido com prova de uso e CTA para pagina da marca",
        theme: "Beleza",
        postDate: "2026-03-05T18:20:00.000Z",
      },
      {
        id: "tutorial-publi-002",
        description: "Sequencia de stories patrocinados com bastidores do uso",
        theme: "Rotina",
        postDate: "2026-02-28T12:10:00.000Z",
      },
    ],
  };
}

function getTutorialPublisResponse() {
  return {
    items: [
      {
        id: "tutorial-publi-001",
        description: "Review rapido com prova de uso e CTA para pagina da marca",
        postDate: "2026-03-05T18:20:00.000Z",
        coverUrl: "/images/Livia Foto D2C.png",
        theme: "Beleza",
        classificationStatus: "completed",
        stats: {
          views: 128000,
          comments: 1240,
          saved: 3180,
          likes: 15200,
          reach: 103400,
        },
        isPubli: true,
        instagramMediaId: "demo-media-001",
        postLink: "https://instagram.com/p/demo001",
      },
      {
        id: "tutorial-publi-002",
        description: "Stories patrocinados com bastidores, depoimento e CTA de conversao",
        postDate: "2026-02-28T12:10:00.000Z",
        coverUrl: "/images/portfolio_exemplo.png",
        theme: "Rotina",
        classificationStatus: "completed",
        stats: {
          views: 84200,
          comments: 410,
          saved: 1180,
          likes: 9600,
          reach: 70120,
        },
        isPubli: true,
        instagramMediaId: "demo-media-002",
        postLink: "https://instagram.com/p/demo002",
      },
      {
        id: "tutorial-publi-003",
        description: "Comparativo de produto com gancho forte e demonstracao objetiva",
        postDate: "2026-02-14T17:40:00.000Z",
        coverUrl: "/images/Tuca-publi.png",
        theme: "Comparativo",
        classificationStatus: "completed",
        stats: {
          views: 156400,
          comments: 1980,
          saved: 4020,
          likes: 21400,
          reach: 131220,
        },
        isPubli: true,
        instagramMediaId: "demo-media-003",
        postLink: "https://instagram.com/p/demo003",
      },
    ],
    pagination: {
      page: 1,
      limit: 12,
      total: 3,
      pages: 1,
    },
  };
}

async function installTutorialDemoMocks(page: Page, step: StoryboardStep, baseUrl: string) {
  if (step.id !== "platform-campaigns" && step.id !== "platform-publis") return;

  await page.route("**/api/**", async (route) => {
    const requestUrl = route.request().url();
    const requestMethod = route.request().method().toUpperCase();
    const { pathname, searchParams } = new URL(requestUrl);

    if (step.id === "platform-campaigns") {
      if (pathname === "/api/proposals" && requestMethod === "GET") {
        await fulfillJson(route, { items: [getTutorialCampaignListItem()] });
        return;
      }

      if (pathname === `/api/proposals/${TUTORIAL_CAMPAIGN_ID}` && requestMethod === "GET") {
        await fulfillJson(route, getTutorialCampaignDetail());
        return;
      }

      if (
        pathname === `/api/proposals/${TUTORIAL_CAMPAIGN_ID}/links` &&
        requestMethod === "GET" &&
        searchParams.get("includeLinkables") === "1"
      ) {
        await fulfillJson(route, getTutorialCampaignLinks());
        return;
      }

      if (pathname === "/api/users/media-kit-token" && requestMethod === "GET") {
        await fulfillJson(route, {
          url: `${baseUrl}/mediakit/livia-linhares`,
          publicUrl: `${baseUrl}/mediakit/livia-linhares`,
        });
        return;
      }
    }

    if (step.id === "platform-publis") {
      if (pathname === "/api/publis" && requestMethod === "GET") {
        await fulfillJson(route, getTutorialPublisResponse());
        return;
      }

      if (pathname === "/api/proposals" && requestMethod === "GET") {
        await fulfillJson(route, { items: [getTutorialCampaignListItem()] });
        return;
      }

      if (pathname === `/api/proposals/${TUTORIAL_CAMPAIGN_ID}/links` && requestMethod === "GET") {
        await fulfillJson(route, {
          items: getTutorialCampaignLinks().items.filter((item) => item.entityType === "publi"),
        });
        return;
      }
    }

    await route.continue();
  });
}

function resolveExistingStorageStatePath(candidatePath: string | null): string | undefined {
  if (!candidatePath) return undefined;
  return existsSync(candidatePath) ? candidatePath : undefined;
}

function resolveStorageStatePathForStep(options: CliOptions, step: StoryboardStep): string | undefined {
  if (step.id === "platform-campaigns") {
    return (
      resolveExistingStorageStatePath(options.campaignsStorageStatePath) ??
      resolveExistingStorageStatePath(options.storageStatePath)
    );
  }

  if (step.id === "platform-publis") {
    return (
      resolveExistingStorageStatePath(options.publisStorageStatePath) ??
      resolveExistingStorageStatePath(options.storageStatePath)
    );
  }

  return resolveExistingStorageStatePath(options.storageStatePath);
}

async function trimRecordedVideo(
  inputPath: string,
  outputPath: string,
  startMs: number,
  durationMs: number,
) {
  const startSeconds = Math.max(0, startMs / 1000).toFixed(3);
  const durationSeconds = Math.max(0.5, durationMs / 1000).toFixed(3);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-ss",
        startSeconds,
        "-i",
        inputPath,
        "-t",
        durationSeconds,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        outputPath,
      ],
      { stdio: "ignore" },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg trim exit=${code}`));
    });
  });
}

async function concatVideoSegments(segmentPaths: string[], outputPath: string) {
  if (!segmentPaths.length) {
    throw new Error("Nenhum segmento de video disponivel para concatenar.");
  }

  if (segmentPaths.length === 1) {
    const singleSegmentPath = segmentPaths[0];
    if (!singleSegmentPath) {
      throw new Error("Segmento unico de video nao encontrado para copia.");
    }
    await copyFile(singleSegmentPath, outputPath);
    return;
  }

  const concatFilePath = path.join(path.dirname(outputPath), "video-concat.txt");
  const concatEntries = segmentPaths.map((filePath) => `file '${escapeConcatFilePath(filePath)}'`).join("\n");
  await writeFile(concatFilePath, `${concatEntries}\n`, "utf8");

  const runConcat = async (args: string[], label: string) => {
    await new Promise<void>((resolve, reject) => {
      let stderr = "";
      const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });

      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `${label} exit=${code}${stderr.trim() ? `\n${stderr.trim().slice(-1600)}` : ""}`,
          ),
        );
      });
    });
  };

  try {
    await runConcat(
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFilePath,
        "-c",
        "copy",
        outputPath,
      ],
      "ffmpeg concat video",
    );
  } catch {
    await runConcat(
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFilePath,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      "ffmpeg concat video reencode",
    );
  }
}

async function captureStoryboardStep(
  browser: Browser,
  options: CliOptions,
  step: StoryboardStep,
  targetDurationMs: number,
  videoDir: string,
): Promise<CapturedStoryboardStep> {
  const candidateRoutes = [step.route, ...(step.alternateRoutes ?? [])];
  const attemptErrors: string[] = [];

  for (const [attemptIndex, route] of candidateRoutes.entries()) {
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      context = await browser.newContext({
        viewport: VIEWPORT,
        colorScheme: "light",
        recordVideo: {
          dir: videoDir,
          size: VIEWPORT,
        },
        storageState: resolveStorageStatePathForStep(options, step),
      });

      page = await context.newPage();
      page.setDefaultTimeout(25_000);
      const recordedVideo = page.video();
      const pageCreatedAt = Date.now();
      const targetUrl = resolveStepUrl(options.baseUrl, route);

      await installTutorialDemoMocks(page, step, options.baseUrl);

      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await dismissRecordingObstructions(page);

      if (step.requiresAuth && page.url().includes("/login")) {
        throw new Error(
          `A etapa "${step.title}" exige sessao autenticada. Gere ${DEFAULT_STORAGE_STATE} e tente novamente.`,
        );
      }

      const resolution = await resolveFocus(page, step);
      if (!resolution.matched) {
        throw new Error(
          `Nao encontrei foco visivel para a etapa "${step.title}".\n${resolution.details ?? ""}`,
        );
      }

      await centerFocus(page, resolution);
      await injectStepOverlay(page, step);
      await sleep(STEP_CAPTURE_SETTLE_MS);

      const finalUrl = page.url();
      const captureStartedAt = Date.now();
      await startCameraMove(page, step, targetDurationMs);
      await sleep(targetDurationMs);
      await sleep(STEP_CAPTURE_TAIL_MS);
      const beforeCloseAt = Date.now();

      await page.close();
      await context.close();

      if (!recordedVideo) {
        throw new Error(`O Playwright nao retornou o arquivo da etapa "${step.title}".`);
      }

      const rawVideoPath = await recordedVideo.path();
      const rawDurationMs = await getMediaDurationMs(rawVideoPath);
      const wallClockDurationMs = Math.max(1, beforeCloseAt - pageCreatedAt);
      const ratio = rawDurationMs / wallClockDurationMs;
      const trimStartMs = Math.max(0, Math.round((captureStartedAt - pageCreatedAt) * ratio));
      const trimDurationMs = Math.max(1_000, Math.round(targetDurationMs * ratio));

      const clipPath = path.join(
        videoDir,
        `${String(attemptIndex + 1).padStart(2, "0")}-${sanitizeFileName(step.id)}.mp4`,
      );
      await trimRecordedVideo(rawVideoPath, clipPath, trimStartMs, trimDurationMs);
      await unlink(rawVideoPath).catch(() => undefined);
      const clipDurationMs = await getMediaDurationMs(clipPath).catch(() => targetDurationMs);

      return {
        id: step.id,
        title: step.title,
        route: finalUrl,
        narration: step.narration,
        requiresAuth: Boolean(step.requiresAuth),
        durationMs: clipDurationMs,
        clipPath,
      };
    } catch (error) {
      attemptErrors.push(
        `Tentativa ${attemptIndex + 1} (${route}): ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (page) await page.close().catch(() => undefined);
      if (context) await context.close().catch(() => undefined);
    }
  }

  throw new Error(attemptErrors.join("\n\n"));
}

async function recordStoryboard(
  options: CliOptions,
  steps: StoryboardStep[],
  narrationSegments: NarrationSegment[],
  videoDir: string,
): Promise<{ timeline: TimelineEntry[]; rawVideoPath: string; warnings: string[] }> {
  const launchOptions = { headless: !options.headed };
  const browser = await chromium.launch(launchOptions);
  const warnings: string[] = [];
  const capturedSteps: CapturedStoryboardStep[] = [];
  const narrationByStepId = new Map(narrationSegments.map((segment) => [segment.stepId, segment]));

  try {
    for (const step of steps) {
      console.log(`- Gravando etapa: ${step.title}`);
      const targetDurationMs = narrationByStepId.get(step.id)?.durationMs ?? estimateStepDurationMs(step);

      try {
        const capturedStep = await captureStoryboardStep(
          browser,
          options,
          step,
          targetDurationMs,
          videoDir,
        );
        capturedSteps.push(capturedStep);
      } catch (error) {
        if (!step.continueOnMissing) throw error;

        const message =
          error instanceof Error
            ? error.message
            : `Falha inesperada na etapa "${step.title}": ${String(error)}`;
        warnings.push(message);
        console.warn(`[sales-tutorial] aviso: etapa pulada -> ${step.title}`);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  if (!capturedSteps.length) {
    throw new Error("Nenhuma etapa foi gravada com sucesso.");
  }

  const timeline: TimelineEntry[] = [];
  let cursorMs = 0;
  for (const step of capturedSteps) {
    const startedAtMs = cursorMs;
    const endedAtMs = startedAtMs + step.durationMs;
    timeline.push({
      id: step.id,
      title: step.title,
      route: step.route,
      narration: step.narration,
      startedAtMs,
      endedAtMs,
      requiresAuth: step.requiresAuth,
    });
    cursorMs = endedAtMs;
  }

  const rawVideoPath = path.join(videoDir, "screen-recording.mp4");
  await concatVideoSegments(
    capturedSteps.map((step) => step.clipPath),
    rawVideoPath,
  );

  if (warnings.length) {
    for (const warning of warnings) {
      console.warn(`[sales-tutorial] ${warning}`);
    }
  }

  return { timeline, rawVideoPath, warnings };
}

function formatVttTimestamp(ms: number): string {
  const totalMs = Math.max(0, ms);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function buildWebVtt(timeline: TimelineEntry[]): string {
  const lines = ["WEBVTT", ""];

  timeline.forEach((entry, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatVttTimestamp(entry.startedAtMs)} --> ${formatVttTimestamp(entry.endedAtMs)}`);
    lines.push(entry.narration);
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}

function renderScriptMarkdown(manifest: TutorialManifest): string {
  const modeNote =
    manifest.effectiveMode === "landing"
      ? "Foco na narrativa comercial publica."
      : manifest.effectiveMode === "platform"
        ? "Foco no tour do produto autenticado."
        : "Foco combinado entre landing publica e produto autenticado.";

  const stepLines = manifest.steps
    .map((step, index) => {
      const start = (step.startedAtMs / 1000).toFixed(1);
      const end = (step.endedAtMs / 1000).toFixed(1);
      return [
        `## ${index + 1}. ${step.title}`,
        `- Janela: ${start}s -> ${end}s`,
        `- Tela: \`${step.route}\``,
        `- Narracao: ${step.narration}`,
        "",
      ].join("\n");
    })
    .join("\n");

  return `# Tutorial comercial da plataforma

- Gerado em: ${manifest.generatedAt}
- Modo solicitado: ${manifest.requestedMode}
- Modo executado: ${manifest.effectiveMode}
- Base URL: ${manifest.baseUrl}
- Nota: ${modeNote}

## Gancho de venda

A plataforma organiza a jornada inteira do criador em um fluxo unico: analise de perfil, planejamento, roteiros, review, descoberta, precificacao, midia kit, campanhas, publis e afiliados.

## Storyboard

${stepLines}`.trimEnd() + "\n";
}

function hasFfmpeg(): boolean {
  const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return result.status === 0;
}

async function getMediaDurationMs(filePath: string): Promise<number> {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(`ffprobe falhou para ${filePath}: ${result.stderr || result.stdout}`.trim());
  }

  const durationSeconds = Number.parseFloat(String(result.stdout || "").trim());
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Duracao invalida retornada pelo ffprobe para ${filePath}.`);
  }

  return Math.round(durationSeconds * 1000);
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function escapeConcatFilePath(filePath: string) {
  return filePath.replace(/'/g, "'\\''");
}

async function mergeVideoAndAudio(
  rawVideoPath: string,
  narrationPath: string,
  outputDir: string,
): Promise<string | null> {
  if (!hasFfmpeg()) return null;

  const finalVideoPath = path.join(outputDir, "sales-tutorial.mp4");
  const canCopyVideo = path.extname(rawVideoPath).toLowerCase() === ".mp4";
  const ffmpegArgs = [
    "-y",
    "-i",
    rawVideoPath,
    "-i",
    narrationPath,
    "-c:v",
    canCopyVideo ? "copy" : "libx264",
    ...(canCopyVideo ? [] : ["-pix_fmt", "yuv420p"]),
    "-c:a",
    "aac",
    "-shortest",
    finalVideoPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", ffmpegArgs, {
      stdio: "ignore",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg encerrou com codigo ${code}.`));
    });
  });

  return finalVideoPath;
}

async function generateContactSheet(videoPath: string, outputDir: string): Promise<string | null> {
  if (!hasFfmpeg()) return null;

  const outputPath = path.join(outputDir, "contact-sheet.jpg");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-vf",
        "fps=1/4,scale=480:-1,tile=4x4",
        "-frames:v",
        "1",
        outputPath,
      ],
      { stdio: "ignore" },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg contact-sheet exit=${code}`));
    });
  });

  return outputPath;
}

async function synthesizeNarrationSegments(
  manifest: TutorialManifest,
  steps: StoryboardStep[],
  outputDir: string,
  voice: string,
): Promise<NarrationSegment[]> {
  if (!process.env.OPENAI_API_KEY) {
    manifest.warnings.push("OPENAI_API_KEY ausente. Narracao em audio nao foi gerada.");
    return [];
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const segmentsDir = path.join(outputDir, "narration-segments");
  await mkdir(segmentsDir, { recursive: true });

  const segments: NarrationSegment[] = [];

  for (const [index, step] of steps.entries()) {
    const fileName = `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(step.title)}.mp3`;
    const filePath = path.join(segmentsDir, fileName);

    const response = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: voice as
        | "alloy"
        | "ash"
        | "ballad"
        | "coral"
        | "echo"
        | "fable"
        | "nova"
        | "onyx"
        | "sage"
        | "shimmer"
        | "verse",
      response_format: "mp3",
      instructions:
        "Narre em portugues do Brasil, com tom objetivo, comercial e confiante. Fale de forma clara, sem exagero.",
      input: step.narration,
    });

    const arrayBuffer = await response.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));
    const durationMs = await getMediaDurationMs(filePath);

    segments.push({
      stepId: step.id,
      title: step.title,
      narration: step.narration,
      filePath,
      durationMs,
    });
  }

  return segments;
}

async function createSilentAudio(filePath: string, durationMs: number) {
  const durationSeconds = (durationMs / 1000).toFixed(3);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=24000:cl=mono",
        "-t",
        durationSeconds,
        "-q:a",
        "9",
        "-acodec",
        "libmp3lame",
        filePath,
      ],
      { stdio: "ignore" },
    );
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg silence exit=${code}`))));
  });
}

async function composeNarrationTrack(
  manifest: TutorialManifest,
  timeline: TimelineEntry[],
  segments: NarrationSegment[],
  outputDir: string,
  totalVideoDurationMs: number,
): Promise<string | null> {
  if (!segments.length) return null;
  if (!hasFfmpeg()) {
    manifest.warnings.push("ffmpeg nao encontrado. Nao foi possivel compor a narracao final por etapas.");
    return null;
  }

  const segmentMap = new Map(segments.map((segment) => [segment.stepId, segment]));
  const audioPartsDir = path.join(outputDir, "narration-track-parts");
  await mkdir(audioPartsDir, { recursive: true });

  const concatEntries: string[] = [];
  let cursorMs = 0;
  let silenceIndex = 0;

  for (const entry of timeline) {
    const segment = segmentMap.get(entry.id);
    if (!segment) continue;

    const gapMs = Math.max(0, entry.startedAtMs - cursorMs);
    if (gapMs > 120) {
      silenceIndex += 1;
      const silencePath = path.join(audioPartsDir, `${String(silenceIndex).padStart(2, "0")}-silence.mp3`);
      await createSilentAudio(silencePath, gapMs);
      concatEntries.push(`file '${escapeConcatFilePath(silencePath)}'`);
      cursorMs += gapMs;
    }

    concatEntries.push(`file '${escapeConcatFilePath(segment.filePath)}'`);
    cursorMs = entry.endedAtMs;
  }

  const tailMs = Math.max(0, totalVideoDurationMs - cursorMs);
  if (tailMs > 120) {
    silenceIndex += 1;
    const silencePath = path.join(audioPartsDir, `${String(silenceIndex).padStart(2, "0")}-tail-silence.mp3`);
    await createSilentAudio(silencePath, tailMs);
    concatEntries.push(`file '${escapeConcatFilePath(silencePath)}'`);
  }

  const concatFilePath = path.join(outputDir, "narration-concat.txt");
  await writeFile(concatFilePath, `${concatEntries.join("\n")}\n`, "utf8");

  const outputPath = path.join(outputDir, "narration.mp3");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFilePath,
        "-c",
        "copy",
        outputPath,
      ],
      { stdio: "ignore" },
    );
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg concat exit=${code}`))));
  });

  return outputPath;
}

async function ensureNonEmpty(filePath: string) {
  const info = await stat(filePath);
  if (info.size <= 0) {
    throw new Error(`Artefato vazio gerado: ${filePath}`);
  }
}

async function main() {
  const options = parseCli();
  const outputDir = path.resolve(process.cwd(), options.outputRoot, getTimestampLabel());
  await mkdir(outputDir, { recursive: true });

  if (!hasFfmpeg()) {
    throw new Error("ffmpeg e obrigatorio para gravar, recortar e montar o tutorial em clips.");
  }

  const authAvailable = Boolean(options.storageStatePath && existsSync(options.storageStatePath));
  if (options.mode === "platform" && !authAvailable) {
    throw new Error(
      `Modo platform exige sessao autenticada. Gere ${DEFAULT_STORAGE_STATE} ou informe --storage-state.`,
    );
  }

  const effectiveMode = options.mode === "sales" && !authAvailable ? "landing" : options.mode;

  const warnings: string[] = [];
  if (options.mode !== effectiveMode) {
    warnings.push(
      `Modo ${options.mode} ajustado para ${effectiveMode} porque nao foi encontrado storageState autenticado.`,
    );
  }

  if (options.campaignsStorageStatePath && !existsSync(options.campaignsStorageStatePath)) {
    warnings.push(
      `Storage state dedicado de campanhas nao encontrado em ${options.campaignsStorageStatePath}. Usando a sessao padrao.`,
    );
  }

  if (options.publisStorageStatePath && !existsSync(options.publisStorageStatePath)) {
    warnings.push(
      `Storage state dedicado de publis nao encontrado em ${options.publisStorageStatePath}. Usando a sessao padrao.`,
    );
  }

  const steps = getSalesTutorialStoryboard({
    mode: effectiveMode,
    authAvailable,
  });

  if (!steps.length) {
    throw new Error("Nenhuma etapa disponivel para o modo selecionado.");
  }

  const manifest: TutorialManifest = {
    requestedMode: options.mode,
    effectiveMode,
    baseUrl: options.baseUrl,
    authAvailable,
    outputDir,
    generatedAt: new Date().toISOString(),
    startedServer: false,
    artifacts: {
      rawVideo: null,
      narrationAudio: null,
      finalVideo: null,
      contactSheet: null,
      captions: path.join(outputDir, "captions.vtt"),
      script: path.join(outputDir, "tutorial-script.md"),
    },
    steps: [],
    warnings,
  };

  const startedServer = await maybeStartServer(options, outputDir);
  manifest.startedServer = startedServer.started;

  try {
    let narrationSegments: NarrationSegment[] = [];
    if (!options.skipTts) {
      try {
        narrationSegments = await synthesizeNarrationSegments(manifest, steps, outputDir, options.voice);
      } catch (error) {
        manifest.warnings.push(
          `Falha ao gerar narracao por etapas: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      manifest.warnings.push("Narracao em audio pulada por --skip-tts.");
    }

    const recording = await recordStoryboard(options, steps, narrationSegments, outputDir);
    const rawVideoPath = recording.rawVideoPath;
    manifest.artifacts.rawVideo = rawVideoPath;
    manifest.steps = recording.timeline;
    manifest.warnings.push(...recording.warnings);

    await ensureNonEmpty(rawVideoPath);
    await writeFile(manifest.artifacts.captions, buildWebVtt(manifest.steps), "utf8");
    await writeFile(manifest.artifacts.script, renderScriptMarkdown(manifest), "utf8");
    try {
      const contactSheetPath = await generateContactSheet(rawVideoPath, outputDir);
      if (contactSheetPath) {
        manifest.artifacts.contactSheet = contactSheetPath;
        await ensureNonEmpty(contactSheetPath);
      }
    } catch (error) {
      manifest.warnings.push(
        `Falha ao gerar contact sheet: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!options.skipTts && narrationSegments.length) {
      try {
        const totalVideoDurationMs = await getMediaDurationMs(rawVideoPath);
        const narrationPath = await composeNarrationTrack(
          manifest,
          manifest.steps,
          narrationSegments,
          outputDir,
          totalVideoDurationMs,
        );
        if (narrationPath) {
          manifest.artifacts.narrationAudio = narrationPath;
          await ensureNonEmpty(narrationPath);
        }
      } catch (error) {
        manifest.warnings.push(
          `Falha ao gerar narracao por TTS: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!options.skipMerge && manifest.artifacts.rawVideo && manifest.artifacts.narrationAudio) {
      try {
        const merged = await mergeVideoAndAudio(
          manifest.artifacts.rawVideo,
          manifest.artifacts.narrationAudio,
          outputDir,
        );
        if (merged) {
          manifest.artifacts.finalVideo = merged;
        } else {
          manifest.warnings.push("ffmpeg nao encontrado. Video final com audio nao foi combinado.");
        }
      } catch (error) {
        manifest.warnings.push(
          `Falha ao combinar video e audio: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else if (options.skipMerge) {
      manifest.warnings.push("Combinacao final pulada por --skip-merge.");
    }

    await writeFile(path.join(outputDir, "tutorial-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    console.log("");
    console.log("Tutorial comercial gerado.");
    console.log(`- Pasta: ${outputDir}`);
    console.log(`- Video bruto: ${manifest.artifacts.rawVideo ?? "nao gerado"}`);
    console.log(`- Audio: ${manifest.artifacts.narrationAudio ?? "nao gerado"}`);
    console.log(`- Video final: ${manifest.artifacts.finalVideo ?? "nao gerado"}`);
    console.log(`- Contact sheet: ${manifest.artifacts.contactSheet ?? "nao gerado"}`);
    console.log(`- Script: ${manifest.artifacts.script}`);
    console.log(`- Legendas: ${manifest.artifacts.captions}`);

    if (manifest.warnings.length) {
      console.log("- Avisos:");
      for (const warning of manifest.warnings) {
        console.log(`  * ${warning}`);
      }
    }
  } finally {
    if (startedServer.process) {
      startedServer.process.kill("SIGTERM");
    }
  }
}

main().catch(async (error) => {
  console.error(`[sales-tutorial] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
