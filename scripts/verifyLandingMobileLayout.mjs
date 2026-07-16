import { chromium, webkit } from "playwright";

const baseUrl = process.env.LANDING_BASE_URL ?? "http://127.0.0.1:3101";
const webkitExecutablePath = process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH;
const viewports = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

const mobileSectionBudgets = {
  community: 1,
  "data-proof": 0.95,
  "connection-flow": 0.7,
  "weekly-community": 1.25,
  "whatsapp-community": 1.25,
  manifesto: 1.2,
  authority: 1.55,
  "market-value": 1.55,
  pricing: 1.25,
  faq: 1.35,
  final: 0.9,
};

function assertLayout(condition, message, details) {
  if (!condition) {
    throw new Error(`${message}\n${JSON.stringify(details, null, 2)}`);
  }
}

async function inspectPage(browser, browserName, viewport, reducedMotion = "reduce") {
  const context = await browser.newContext({
    viewport,
    reducedMotion,
  });
  await context.addCookies([
    {
      name: "cookie_consent",
      value: "accepted",
      domain: new URL(baseUrl).hostname,
      path: "/",
    },
  ]);

  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const hero = await page.locator(".d2c-human-hero").boundingBox();
  const portrait = await page.locator(".d2c-human-hero__portrait").boundingBox();
  const mobileImage = await page.locator(".d2c-human-hero__mobile-image").boundingBox();
  const matchSection = await page.locator(".d2c-human-match").boundingBox();

  assertLayout(hero && portrait && mobileImage && matchSection, "Elementos principais da landing não foram encontrados.", {
    browserName,
    viewport,
    hero,
    portrait,
    mobileImage,
    matchSection,
  });

  const boundaryGap = matchSection.y - (portrait.y + portrait.height);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assertLayout(Math.abs(boundaryGap) <= 1, "A fronteira entre hero e match voltou a sobrepor ou abrir um vazio.", {
    browserName,
    viewport,
    boundaryGap,
  });
  assertLayout(Math.abs(portrait.height - mobileImage.height) <= 1, "A imagem mobile deixou de definir a altura real do retrato.", {
    browserName,
    viewport,
    portrait,
    mobileImage,
  });
  assertLayout(horizontalOverflow <= 1, "A landing criou overflow horizontal no mobile.", {
    browserName,
    viewport,
    horizontalOverflow,
  });

  const dataProof = await page.locator(".d2c-data-proof").boundingBox();
  const dataNote = await page.locator(".d2c-data-proof__note").boundingBox();
  const bridge = await page.locator(".d2c-connection-bridge").boundingBox();
  const bridgeStatement = await page.locator(".d2c-connection-bridge__statement").boundingBox();
  assertLayout(dataProof && dataNote && bridge && bridgeStatement, "A transição entre dados e comunidade não foi renderizada.", {
    browserName,
    viewport,
    dataProof,
    dataNote,
    bridge,
    bridgeStatement,
  });
  const dataExitGap = dataProof.y + dataProof.height - (dataNote.y + dataNote.height);
  const bridgeEntryGap = bridgeStatement.y - bridge.y;
  assertLayout(dataExitGap >= 44, "A prova de dados perdeu o respiro de saída no mobile.", {
    browserName,
    viewport,
    dataExitGap,
  });
  assertLayout(bridgeEntryGap >= 56, "A ponte preta voltou a começar perto demais da troca de cor.", {
    browserName,
    viewport,
    bridgeEntryGap,
  });

  await page.locator(".d2c-match-stage").scrollIntoViewIfNeeded();
  const canvasBefore = await page.locator(".d2c-match-stage__canvas").boundingBox();
  if (reducedMotion === "no-preference") {
    await page.waitForSelector(".d2c-match-reveal", { timeout: 10_000 });
  }

  const canvasAfter = await page.locator(".d2c-match-stage__canvas").boundingBox();
  const reveal = await page.locator(".d2c-match-reveal").boundingBox();
  const cta = await page.locator(".d2c-match-reveal__cta").boundingBox();
  const replay = reducedMotion === "no-preference"
    ? await page.locator(".d2c-match-stage__replay").boundingBox()
    : null;
  const stage = await page.locator(".d2c-match-stage").boundingBox();
  const sectionAfter = await page.locator(".d2c-human-match").boundingBox();

  assertLayout(canvasBefore && canvasAfter && reveal && cta && stage && sectionAfter, "O estado final do match não foi renderizado por inteiro.", {
    browserName,
    viewport,
    canvasBefore,
    canvasAfter,
    reveal,
    cta,
    stage,
    sectionAfter,
  });
  assertLayout(Math.abs(canvasBefore.height - canvasAfter.height) <= 1, "A animação alterou a altura do palco.", {
    browserName,
    viewport,
    before: canvasBefore.height,
    after: canvasAfter.height,
  });
  assertLayout(reveal.y >= canvasAfter.y - 1 && reveal.y + reveal.height <= canvasAfter.y + canvasAfter.height + 1, "O card final ultrapassou o palco.", {
    browserName,
    viewport,
    reveal,
    canvasAfter,
  });
  assertLayout(cta.y >= reveal.y && cta.y + cta.height <= reveal.y + reveal.height + 1, "O CTA foi cortado pelo card final.", {
    browserName,
    viewport,
    cta,
    reveal,
  });
  if (replay) {
    assertLayout(replay.y + replay.height <= sectionAfter.y + sectionAfter.height + 1, "O controle de replay foi cortado pela seção.", {
      browserName,
      viewport,
      replay,
      sectionAfter,
    });
  }

  const whatsappChat = page.locator(".d2c-whatsapp-chat");
  await whatsappChat.scrollIntoViewIfNeeded();
  if (reducedMotion === "no-preference") await page.waitForTimeout(1700);
  const visibleChatMessages = await whatsappChat.locator("ol > li").count();
  assertLayout(await whatsappChat.isVisible(), "A conversa da comunidade não apareceu no mobile.", {
    browserName,
    viewport,
  });
  assertLayout(visibleChatMessages >= (reducedMotion === "reduce" ? 6 : 2), "A conversa da comunidade não revelou mensagens suficientes.", {
    browserName,
    viewport,
    reducedMotion,
    visibleChatMessages,
  });
  assertLayout(!(await page.locator(".d2c-whatsapp-community__stream--desktop").isVisible()), "A demonstração antiga do WhatsApp reapareceu no mobile.", {
    browserName,
    viewport,
  });
  assertLayout(!(await page.locator(".d2c-creator-manifesto").isVisible()), "O manifesto redundante reapareceu no mobile.", {
    browserName,
    viewport,
  });

  let rhythm = null;
  if (reducedMotion === "no-preference") {
    rhythm = await page.locator("main > section").evaluateAll((sections, viewportHeight) => sections.map((section) => {
      const height = section.getBoundingClientRect().height;
      const className = typeof section.className === "string" ? section.className : "";
      return {
        name: section.getAttribute("data-landing-section")
          || (className.includes("d2c-human-final") ? "final" : className.includes("d2c-human-hero") ? "hero" : "unknown"),
        height: Math.round(height),
        screens: Number((height / viewportHeight).toFixed(2)),
      };
    }), viewport.height);

    const totalScreens = rhythm.reduce((total, section) => total + section.screens, 0);
    assertLayout(totalScreens <= 14.5, "O ritmo mobile voltou a exigir scroll vertical excessivo.", {
      browserName,
      viewport,
      totalScreens,
      rhythm,
    });

    for (const section of rhythm) {
      const budget = mobileSectionBudgets[section.name];
      if (budget === undefined) continue;
      assertLayout(section.screens <= budget, `A seção ${section.name} ultrapassou o orçamento vertical mobile.`, {
        browserName,
        viewport,
        budget,
        section,
      });
    }
  }

  await context.close();
  return {
    browser: browserName,
    viewport: `${viewport.width}x${viewport.height}`,
    mode: reducedMotion,
    heroMatchGap: Number(boundaryGap.toFixed(2)),
    dataExitGap: Number(dataExitGap.toFixed(2)),
    bridgeEntryGap: Number(bridgeEntryGap.toFixed(2)),
    canvasHeight: Number(canvasAfter.height.toFixed(2)),
    horizontalOverflow,
    totalScreens: rhythm ? Number(rhythm.reduce((total, section) => total + section.screens, 0).toFixed(2)) : "—",
  };
}

const chromiumBrowser = await chromium.launch({ headless: true });
const webkitBrowser = await webkit.launch({
  headless: true,
  ...(webkitExecutablePath ? { executablePath: webkitExecutablePath } : {}),
});

try {
  const staticChecks = await Promise.all([
    ...viewports.map((viewport) => inspectPage(chromiumBrowser, "chromium", viewport)),
    ...viewports.map((viewport) => inspectPage(webkitBrowser, "webkit", viewport)),
  ]);
  const dynamicChecks = await Promise.all([
    ...viewports.map((viewport) => inspectPage(chromiumBrowser, "chromium", viewport, "no-preference")),
    ...viewports.map((viewport) => inspectPage(webkitBrowser, "webkit", viewport, "no-preference")),
  ]);

  console.table([...staticChecks, ...dynamicChecks]);
} finally {
  await Promise.all([chromiumBrowser.close(), webkitBrowser.close()]);
}
