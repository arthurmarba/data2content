/** @jest-environment node */
import fs from "fs";
import path from "path";

const EXPECTED_FACEBOOK_RECONNECT_ENTRYPOINTS = [
  "src/app/dashboard/ChatPanel.tsx",
  "src/app/dashboard/InstagramConnectCard.tsx",
  "src/app/dashboard/instagram-connection/page.tsx",
  "src/app/dashboard/instagram/connect/page.tsx",
  "src/app/dashboard/media-kit/page.tsx",
];

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
      .filter((filePath) => readWorkspaceFile(path.relative(process.cwd(), filePath)).match(/signIn\((['"])facebook\1/))
      .map((filePath) => path.relative(process.cwd(), filePath))
      .sort();

    expect(discovered).toEqual([...EXPECTED_FACEBOOK_RECONNECT_ENTRYPOINTS].sort());
  });

  it("ensures each reconnect entrypoint calls start endpoint and forwards flowId to canonical callback", () => {
    for (const filePath of EXPECTED_FACEBOOK_RECONNECT_ENTRYPOINTS) {
      const content = readWorkspaceFile(filePath);

      expect(content).toMatch(/fetch\((['"])\/api\/auth\/iniciar-vinculacao-fb\1/);
      expect(content).toContain("flowIdParam");
      expect(content).toContain("/dashboard/instagram/connecting?instagramLinked=true&next=");
      expect(content).toContain("${flowIdParam}");
    }
  });
});
