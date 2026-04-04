import fs from "node:fs/promises";
import path from "node:path";

import { request } from "@playwright/test";

import { loginByRequestCredentials } from "../tests/e2e/auth/loginByRequest";

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
