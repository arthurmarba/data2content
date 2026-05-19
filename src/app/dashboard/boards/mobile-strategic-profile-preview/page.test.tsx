import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import MobileStrategicProfilePreviewPage from "./page";

const originalFlag = process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED;
const adminViewer = { role: "admin" };
const commonViewer = { role: "user" };

afterEach(() => {
  jest.restoreAllMocks();
  if (originalFlag === undefined) {
    delete process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED;
    return;
  }
  process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED = originalFlag;
});

describe("MobileStrategicProfilePreviewPage", () => {
  it("blocks preview when flag is off", async () => {
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED = "0";

    render(await MobileStrategicProfilePreviewPage({ viewer: adminViewer }));

    expect(screen.getByText("Preview interno bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED=1/)).toBeInTheDocument();
    expect(screen.queryByText("Preview interno — Perfil Estratégico")).not.toBeInTheDocument();
  });

  it("blocks preview without admin/dev", async () => {
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED = "1";

    render(await MobileStrategicProfilePreviewPage({ viewer: commonViewer }));

    expect(screen.getByText("Preview interno restrito a usuários admin/dev.")).toBeInTheDocument();
    expect(screen.queryByText("Preview interno — Perfil Estratégico")).not.toBeInTheDocument();
  });

  it("renders preview with flag on and admin/dev", async () => {
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED = "1";

    render(await MobileStrategicProfilePreviewPage({ viewer: adminViewer }));

    expect(screen.getByText("Preview interno — Perfil Estratégico")).toBeInTheDocument();
    expect(screen.getByText("Perfil Estratégico mobile")).toBeInTheDocument();
    expect(screen.getAllByText("Diagnóstico").length).toBeGreaterThan(0);
  });

  it("state query selects fixture", async () => {
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED = "1";

    render(
      await MobileStrategicProfilePreviewPage({
        viewer: adminViewer,
        searchParams: { state: "media_kit_available" },
      }),
    );

    expect(screen.getAllByText("Mídia Kit").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
  });

  it("does not import forbidden integrations or real UI surfaces", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of [
      "LoginClient",
      "NextAuth",
      "MediaKitView",
      "ActivationPendingWidget",
      "Sidebar",
      "fetch",
      "Prisma",
      "Gemini",
      "OpenAI",
      "Stripe",
      "SDK",
    ]) {
      expect(importLines).not.toContain(forbidden);
    }
  });
});
