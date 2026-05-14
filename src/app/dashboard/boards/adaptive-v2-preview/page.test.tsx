import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import AdaptiveV2PreviewPage from "./page";

const originalEnvValue = process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED;
const adminViewer = { role: "admin" };
const devViewer = { role: "dev" };
const commonViewer = { role: "user" };

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED;
    return;
  }

  process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = originalEnvValue;
});

describe("AdaptiveV2PreviewPage", () => {
  it("renders a blocked state when the internal flag is off", async () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "0";

    render(await AdaptiveV2PreviewPage({ viewer: adminViewer }));

    expect(screen.getByText("Board Adaptativo V2")).toBeInTheDocument();
    expect(screen.getByText("Preview interno bloqueado. Ative a flag correspondente para visualizar esta rota.")).toBeInTheDocument();
    expect(screen.queryByText("Leitura inicial")).not.toBeInTheDocument();
  });

  it("blocks common users even when the flag is on", async () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "1";

    render(await AdaptiveV2PreviewPage({ viewer: commonViewer }));

    expect(screen.getByText("Preview interno restrito a usuários admin/dev.")).toBeInTheDocument();
    expect(screen.queryByText("Leitura inicial")).not.toBeInTheDocument();
  });

  it("renders the default validate-pauta scenario when enabled for admin", async () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "1";

    render(await AdaptiveV2PreviewPage({ viewer: adminViewer }));

    expect(screen.getByText("Preview interno — Board Adaptativo V2")).toBeInTheDocument();
    expect(screen.getByText("Leitura inicial")).toBeInTheDocument();
    expect(screen.getByText("Caminhos de decisão")).toBeInTheDocument();
    expect(screen.getByText("Leitura da rodada")).toBeInTheDocument();
    expect(screen.getByText("Plano estratégico")).toBeInTheDocument();
    expect(screen.getAllByText("Validar pauta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("validate_pauta").length).toBeGreaterThan(0);
  });

  it("renders the brand match scenario from search params", async () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "1";

    render(await AdaptiveV2PreviewPage({ searchParams: { scenario: "brand-match" }, viewer: adminViewer }));

    expect(screen.getAllByText("Match com marca").length).toBeGreaterThan(0);
    expect(screen.getAllByText("brand_match").length).toBeGreaterThan(0);
    expect(screen.getByText("Encaixe com marca")).toBeInTheDocument();
    expect(screen.queryByText("Encaixe com collab")).not.toBeInTheDocument();
  });

  it("renders the collab match scenario from search params for dev", async () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "1";

    render(await AdaptiveV2PreviewPage({ searchParams: { scenario: "collab-match" }, viewer: devViewer }));

    expect(screen.getAllByText("Match com collab").length).toBeGreaterThan(0);
    expect(screen.getAllByText("collab_match").length).toBeGreaterThan(0);
    expect(screen.getByText("Encaixe com collab")).toBeInTheDocument();
  });

  it("falls back to the default scenario when search params are invalid", async () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "1";

    render(await AdaptiveV2PreviewPage({ searchParams: { scenario: "missing-scenario" }, viewer: adminViewer }));

    expect(screen.getAllByText("Validar pauta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("validate_pauta").length).toBeGreaterThan(0);
  });

  it("continues without proof or visual score language", async () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "1";

    const { container } = render(
      await AdaptiveV2PreviewPage({ searchParams: { scenario: "brand-match" }, viewer: adminViewer }),
    );
    const text = container.textContent?.toLowerCase() || "";

    for (const forbidden of ["score", "nota", "pontuação", "acerto", "erro", "gabarito", "resposta correta"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not import BoardShell or real product flow dependencies", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

    expect(source).not.toMatch(/PostCreationFunnelBoardShell/);
    expect(source).not.toMatch(/BoardShell/);
    expect(source).not.toMatch(/usePostCreation/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/OpenAI/);
    expect(source).not.toMatch(/openai/);
    expect(source).not.toMatch(/prisma/);
    expect(source).not.toMatch(/route handler/i);
  });
});
