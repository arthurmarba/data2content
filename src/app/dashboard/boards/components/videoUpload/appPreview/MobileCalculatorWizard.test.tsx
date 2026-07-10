import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MobileCalculatorWizard } from "./MobileCalculatorWizard";

const onClose = jest.fn();
const onSaved = jest.fn();

function jsonResponse(payload: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(payload) });
}

describe("MobileCalculatorWizard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/calculator/personal-reference" && (!init?.method || init.method === "GET")) {
        return jsonResponse({ reference: null });
      }
      if (String(input) === "/api/calculator") {
        return jsonResponse({
          estrategico: 1200,
          justo: 1600,
          premium: 2100,
          metrics: { reach: 12400, reachSampleSize: 5, reachMethod: "trimmed_mean", reachConfidence: "alta" },
          personalReference: { applied: true, reason: "applied", baseJusto: 1500, adjustedJusto: 1600 },
        });
      }
      return jsonResponse({ reference: { valueBRL: 1500, confirmedAt: "2026-07-10T10:00:00.000Z" } });
    }) as jest.Mock;
  });

  function renderWizard() {
    return render(<MobileCalculatorWizard open onClose={onClose} onSaved={onSaved} suggestedReach={12400} />);
  }

  it("abre com um Reel e reúne todos os critérios na etapa de condições", async () => {
    renderWizard();

    expect(screen.getByText("Entrega")).toBeInTheDocument();
    expect(screen.getByText("Reels").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Stories").parentElement).toHaveTextContent("0");
    expect(screen.getByText("Seu valor habitual")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Uso pela marca")).toBeInTheDocument();
    expect(screen.getByText("Exclusividade")).toBeInTheDocument();
    expect(screen.getByText("Collab no Instagram")).toBeInTheDocument();
    expect(screen.getByText("Repost no TikTok")).toBeInTheDocument();
    expect(screen.getByText("UGC para perfil da marca")).toBeInTheDocument();
    expect(screen.getByText("Porte da marca")).toBeInTheDocument();
    expect(screen.getByText("Risco de imagem")).toBeInTheDocument();
    expect(screen.getByText("Ganho estratégico")).toBeInTheDocument();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/calculator/personal-reference", { cache: "no-store" }));
  });

  it("salva a referência no próprio modal e apresenta as três faixas", async () => {
    renderWizard();

    fireEvent.change(screen.getByLabelText("Valor habitual por Reel orgânico"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/calculator/personal-reference",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ valueBRL: 1500 }) }),
    ));

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver meu valor" }));

    expect(await screen.findByText("Mínimo")).toBeInTheDocument();
    expect(screen.getByText("Justo")).toBeInTheDocument();
    expect(screen.getByText("Máximo")).toBeInTheDocument();
    expect(screen.getByText(/Seu valor habitual foi considerado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar para a etapa anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
  });
});
