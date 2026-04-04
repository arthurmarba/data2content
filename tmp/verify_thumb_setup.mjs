import fs from "node:fs/promises";
import path from "node:path";

import { request } from "@playwright/test";

function formEncode(data) {
  return new URLSearchParams(data).toString();
}

async function loginByRequestCredentials(api, { baseURL, email, password, callbackPath = "/dashboard/chat", timeoutMs = 90_000 }) {
  const callbackUrl = new URL(callbackPath, baseURL).toString();

  const csrfRes = await api.get("/api/auth/csrf", { timeout: timeoutMs });
  if (!csrfRes.ok()) {
    throw new Error(`CSRF failed: ${csrfRes.status()} ${await csrfRes.text()}`);
  }

  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson?.csrfToken;
  if (!csrfToken) {
    throw new Error("CSRF token missing from /api/auth/csrf response");
  }

  const loginRes = await api.post("/api/auth/callback/credentials", {
    timeout: timeoutMs,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: formEncode({
      csrfToken,
      callbackUrl,
      json: "true",
      email,
      password,
    }),
  });

  if (!(loginRes.ok() || loginRes.status() === 302)) {
    throw new Error(`Login failed: ${loginRes.status()} ${await loginRes.text()}`);
  }

  const sessionRes = await api.get("/api/auth/session", { timeout: timeoutMs });
  if (!sessionRes.ok()) {
    throw new Error(`Session check failed: ${sessionRes.status()} ${await sessionRes.text()}`);
  }

  const session = await sessionRes.json();
  if (!session?.user) {
    throw new Error(`Not authenticated. Session payload: ${JSON.stringify(session)}`);
  }
}

async function main() {
  const baseURL = process.env.E2E_BASE_URL;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!baseURL || !email || !password) {
    throw new Error("Missing E2E_BASE_URL, E2E_EMAIL or E2E_PASSWORD.");
  }

  const outDir = path.join(process.cwd(), "output", "playwright", "verify-thumb");
  await fs.mkdir(outDir, { recursive: true });

  const storagePath = path.join(outDir, "storage.json");
  const api = await request.newContext({ baseURL });

  await loginByRequestCredentials(api, {
    baseURL,
    email,
    password,
    callbackPath: "/planning/roteiros",
  });

  let response = await api.post("/api/dev/e2e/ensure-planner-access");
  if (!response.ok()) {
    throw new Error(`ensure-planner-access failed: ${response.status()} ${await response.text()}`);
  }

  response = await api.post("/api/dev/e2e/scripts-fixture");
  if (!response.ok()) {
    throw new Error(`scripts-fixture failed: ${response.status()} ${await response.text()}`);
  }

  const fixture = await response.json();
  const primaryContentId = String(fixture?.content?.id || "");
  if (!primaryContentId) {
    throw new Error("Fixture content id missing.");
  }

  const now = Date.now();
  const title = `Codex thumb verify ${now}`;
  response = await api.post("/api/scripts", {
    data: {
      mode: "manual",
      title,
      content: `Roteiro para verificar thumbnail ${now}.`,
      isPosted: true,
      postedContentId: primaryContentId,
    },
  });

  if (!response.ok()) {
    throw new Error(`create script failed: ${response.status()} ${await response.text()}`);
  }

  const created = await response.json();
  await api.storageState({ path: storagePath });
  await api.dispose();

  console.log(
    JSON.stringify(
      {
        storagePath,
        scriptId: created?.item?.id || created?.id || null,
        title,
        contentId: primaryContentId,
        fixtureCaption: fixture?.content?.caption || null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
