/** @jest-environment node */
import fs from "fs";
import path from "path";

const EXPECTED_FACEBOOK_RECONNECT_ENTRYPOINTS: Array<{
  filePath: string;
  nextTarget: "chat" | "media-kit" | "instagram-connection";
}> = [
  { filePath: "src/app/dashboard/ChatPanel.tsx", nextTarget: "chat" },
  { filePath: "src/app/dashboard/InstagramConnectCard.tsx", nextTarget: "chat" },
  { filePath: "src/app/dashboard/instagram-connection/page.tsx", nextTarget: "instagram-connection" },
  { filePath: "src/app/dashboard/instagram/connect/page.tsx", nextTarget: "media-kit" },
  { filePath: "src/app/dashboard/media-kit/page.tsx", nextTarget: "media-kit" },
];

const START_RECONNECT_HELPER_PATH = "src/app/lib/instagram/client/startInstagramReconnect.ts";

function readWorkspaceFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function walkFiles(rootDir: string): string[] {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!fullPath.endsWith(".ts") && !fullPath.endsWith(".tsx")) continue;
    files.push(fullPath);
  }
  return files;
}

describe("Instagram reconnect entrypoints", () => {
  it("tracks all facebook reconnect buttons in dashboard pages", () => {
    const dashboardRoot = path.join(process.cwd(), "src/app/dashboard");
    const files = walkFiles(dashboardRoot);
    const discovered = files
      .filter((filePath) => readWorkspaceFile(path.relative(process.cwd(), filePath)).match(/startInstagramReconnect\(\{/))
      .map((filePath) => path.relative(process.cwd(), filePath))
      .sort();

    expect(discovered).toEqual(
      [...EXPECTED_FACEBOOK_RECONNECT_ENTRYPOINTS.map((entry) => entry.filePath)].sort()
    );
  });

  it("ensures each reconnect entrypoint uses the shared helper with the right next target", () => {
    for (const { filePath, nextTarget } of EXPECTED_FACEBOOK_RECONNECT_ENTRYPOINTS) {
      const content = readWorkspaceFile(filePath);
      const nextTargetRegex = new RegExp(`nextTarget:\\s*['\"]${nextTarget}['\"]`);
      expect(content).toMatch(/startInstagramReconnect\(\{/);
      expect(content).toMatch(nextTargetRegex);
    }
  });

  it("ensures shared helper calls start endpoint and forwards flowId to canonical callback", () => {
    const helperContent = readWorkspaceFile(START_RECONNECT_HELPER_PATH);

    expect(helperContent).toMatch(/fetch\((['"])\/api\/auth\/iniciar-vinculacao-fb\1/);
    expect(helperContent).toContain("flowIdParam");
    expect(helperContent).toContain("/dashboard/instagram/connecting?instagramLinked=true&next=");
    expect(helperContent).toContain("${flowIdParam}");
  });
});
