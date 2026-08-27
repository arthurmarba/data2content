/** @jest-environment node */

import { GET } from "./route";

describe("OpenAI plugin domain challenge", () => {
  const originalToken = process.env.OPENAI_APPS_CHALLENGE_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.OPENAI_APPS_CHALLENGE_TOKEN;
    else process.env.OPENAI_APPS_CHALLENGE_TOKEN = originalToken;
  });

  it("returns 404 while no challenge is configured", async () => {
    delete process.env.OPENAI_APPS_CHALLENGE_TOKEN;
    const response = await GET();
    expect(response.status).toBe(404);
  });

  it("returns only the exact configured token", async () => {
    process.env.OPENAI_APPS_CHALLENGE_TOKEN = "openai-verification-token";
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("openai-verification-token");
  });
});
