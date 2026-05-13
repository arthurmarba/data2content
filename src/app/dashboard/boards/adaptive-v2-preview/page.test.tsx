import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import AdaptiveV2PreviewPage from "./page";

const originalEnvValue = process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED;

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED;
    return;
  }

  process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = originalEnvValue;
});

describe("AdaptiveV2PreviewPage", () => {
  it("renders the internal preview when enabled", () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "1";

    render(<AdaptiveV2PreviewPage />);

    expect(screen.getByText("Preview interno — Board Adaptativo V2")).toBeInTheDocument();
    expect(screen.getByText("Leitura inicial")).toBeInTheDocument();
    expect(screen.getByText("Caminhos de decisão")).toBeInTheDocument();
    expect(screen.getByText("Leitura da rodada")).toBeInTheDocument();
    expect(screen.getByText("Plano estratégico")).toBeInTheDocument();
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

  it("continues without proof or visual score language", () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "1";

    const { container } = render(<AdaptiveV2PreviewPage />);
    const text = container.textContent?.toLowerCase() || "";

    for (const forbidden of ["score", "nota", "pontuação", "acerto", "erro", "gabarito", "resposta correta"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("renders a blocked state when the internal flag is off", () => {
    process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED = "0";

    render(<AdaptiveV2PreviewPage />);

    expect(screen.getByText("Preview interno — Board Adaptativo V2")).toBeInTheDocument();
    expect(screen.getByText(/permanece bloqueada/i)).toBeInTheDocument();
    expect(screen.queryByText("Leitura inicial")).not.toBeInTheDocument();
  });
});
