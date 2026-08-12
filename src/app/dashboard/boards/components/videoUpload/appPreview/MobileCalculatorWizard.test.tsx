import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { MobileCalculatorWizard, type MobileCalculatorResult } from "./MobileCalculatorWizard";

const onClose = jest.fn();
const onSaved = jest.fn();

function jsonResponse(payload: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(payload) });
}

function advanceToHistory() {
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
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
          calculationId: "calc-mobile-1",
          metrics: { reach: 12400, reachSampleSize: 5, reachMethod: "trimmed_mean", reachConfidence: "alta" },
          pricing: {
            version: "v2.0.0",
            components: { production: 700, distribution: 500, usageRights: 250, exclusivity: 150, logistics: 0 },
          },
          personalReference: {
            applied: true,
            reason: "applied",
            referenceValueBRL: 1500,
            canonicalJusto: 1400,
            baseJusto: 1500,
            adjustedJusto: 1600,
          },
        });
      }
      return jsonResponse({ reference: { valueBRL: 1500, confirmedAt: "2026-07-10T10:00:00.000Z" } });
    }) as jest.Mock;
  });

  function renderWizard() {
    return render(<MobileCalculatorWizard open onClose={onClose} onSaved={onSaved} suggestedReach={12400} />);
  }

  it("separa entrega, proteção, contexto e histórico em etapas claras", async () => {
    renderWizard();

    expect(screen.getByText("Entrega")).toBeInTheDocument();
    expect(screen.getByText("Reels").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Sequência de 3 Stories").parentElement).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Uso e proteção")).toBeInTheDocument();
    expect(screen.getByText("Uso pela marca")).toBeInTheDocument();
    expect(screen.getByText("Exclusividade")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Contexto da parceria")).toBeInTheDocument();
    expect(screen.getByText("Collab no Instagram")).toBeInTheDocument();
    expect(screen.getByText("Porte da marca")).toBeInTheDocument();
    expect(screen.getByText("Risco de imagem")).toBeInTheDocument();
    expect(screen.getByText("Ganho estratégico")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Seu histórico de preço")).toBeInTheDocument();
    expect(screen.getByText("Adicionar valor habitual")).toBeInTheDocument();
    expect(screen.getByText("Prefiro só a sugestão")).toBeInTheDocument();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/calculator/personal-reference", { cache: "no-store" }));
  });

  it("salva a referência na etapa dedicada e contextualiza as três faixas", async () => {
    renderWizard();
    advanceToHistory();

    fireEvent.click(screen.getByRole("button", { name: /^Adicionar valor habitual/ }));
    fireEvent.change(screen.getByLabelText("Valor habitual por Reel orgânico"), { target: { value: "1.500" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/calculator/personal-reference",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ valueBRL: 1500 }) }),
    ));

    await waitFor(() => expect(screen.getByRole("button", { name: "Ver meu valor" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Ver meu valor" }));

    expect(await screen.findByText("Piso protegido")).toBeInTheDocument();
    expect(screen.getByText("Recomendado agora")).toBeInTheDocument();
    expect(screen.getByText("Potencial ideal")).toBeInTheDocument();
    expect(screen.getByText("Como o valor foi formado")).toBeInTheDocument();
    expect(screen.getByText("Produção")).toBeInTheDocument();
    expect(screen.getByText("Como seu histórico entrou nesta sugestão")).toBeInTheDocument();
    expect(screen.getByText(/Você costuma fechar/i)).toBeInTheDocument();
    expect(screen.getByText("Etapa 5 de 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
  });

  it("permite calcular somente com métricas e preserva o resultado após salvar", async () => {
    function StatefulWizard() {
      const [latestCalculation, setLatestCalculation] = useState<MobileCalculatorResult | null>(null);
      return <MobileCalculatorWizard open onClose={onClose} onSaved={setLatestCalculation} latestCalculation={latestCalculation} suggestedReach={12400} />;
    }

    render(<StatefulWizard />);
    advanceToHistory();
    fireEvent.click(screen.getByRole("button", { name: /^Prefiro só a sugestão/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ver meu valor" }));

    expect(await screen.findByText("Piso protegido")).toBeInTheDocument();
    expect(screen.getByText("Etapa 5 de 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
    expect(screen.queryByText("Seu histórico de preço")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/calculator", expect.objectContaining({
      body: expect.stringContaining('"usePersonalReference":false'),
    }));
  });

  it("pula a etapa de histórico para UGC e volta ao contexto a partir do resultado", async () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    const ugcRow = screen.getByText("UGC para perfil da marca").parentElement;
    expect(ugcRow).not.toBeNull();
    fireEvent.click(within(ugcRow!).getByRole("button", { name: "Sim" }));

    expect(screen.getByText("Etapa 3 de 4")).toBeInTheDocument();
    expect(screen.queryByText("Seu histórico de preço")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver meu valor" }));

    expect(await screen.findByText("Etapa 4 de 4")).toBeInTheDocument();
    await screen.findByText("Recomendado agora");
    expect(global.fetch).toHaveBeenCalledWith("/api/calculator", expect.objectContaining({
      body: expect.stringContaining('"usePersonalReference":false'),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Voltar para a etapa anterior" }));
    expect(screen.getByText("Contexto da parceria")).toBeInTheDocument();
  });

  it("coleta o valor pretendido quando a recomendação parece barata", async () => {
    renderWizard();
    advanceToHistory();
    fireEvent.click(screen.getByRole("button", { name: /^Prefiro só a sugestão/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ver meu valor" }));

    await screen.findByText("Recomendado agora");
    fireEvent.click(screen.getByRole("button", { name: "Barato" }));
    fireEvent.change(screen.getByLabelText("Quanto você cobraria?"), { target: { value: "2.500" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/calculator/calc-mobile-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ perception: "low", intendedAsk: 2500 }) }),
    ));
    expect(await screen.findByText("Obrigado — avaliação salva.")).toBeInTheDocument();
  });

  it("fecha com Escape e mantém o diálogo identificado", () => {
    renderWizard();
    expect(screen.getByRole("dialog", { name: "Entrega" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
