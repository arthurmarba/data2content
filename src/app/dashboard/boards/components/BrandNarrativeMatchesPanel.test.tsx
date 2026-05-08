import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";

import BrandNarrativeMatchesPanel from "./BrandNarrativeMatchesPanel";
import { track } from "@/lib/track";

jest.mock("@/lib/track", () => ({
  track: jest.fn(),
}));

const baseDecision = {
  contextId: "corrida",
  proposalId: "jornada",
  toneId: "inspirador",
  referenceId: null,
  intentId: "inspirar",
  narrativeId: "jornada",
  formatId: "reels",
  durationId: null,
  dayId: null,
  hourId: null,
  themeId: "meia-maratona",
  pautaId: "preparacao-para-prova",
};

const basePauta = {
  title: "Preparação para uma meia maratona",
  description: "Rotina de treino, kit de corrida e bastidores da prova.",
  reason: "A pauta mistura preparação, corrida e conquista pessoal.",
  theme: "corrida",
  keywords: ["corrida", "preparação", "prova"],
};

const baseCategories = {
  context: ["Estilo de Vida e Bem-Estar"],
  proposal: ["rotina real"],
  contentIntent: ["conectar"],
  narrativeForm: ["rotina"],
  contentSignals: ["autocuidado"],
  proofStyle: ["uso cotidiano"],
  commercialMode: ["produto em uso"],
};

const nikeMatch = {
  brandId: "brand-nike",
  brandName: "Nike",
  slug: "nike",
  category: ["esporte"],
  matchScore: 0.82,
  matchLevel: "alto",
  confidenceScore: 0.86,
  matchedSignals: ["corrida"],
  rationale: "A marca combina com a pauta.",
  insertionAngle: "A marca pode entrar como produto em uso real.",
  suggestedDeliverables: ["Reels final com produto em uso"],
  suggestedApproachMessage: "Tenho uma narrativa orgânica para a marca.",
  disclaimer: "Marca sugerida por possível match narrativo.",
};

const lowMatch = {
  brandId: "brand-mundo-verde",
  brandName: "Mundo Verde",
  slug: "mundo-verde",
  category: ["bem-estar"],
  matchScore: 0.28,
  matchLevel: "baixo",
  confidenceScore: 0.66,
  matchedSignals: ["estar", "vida", "bem", "base"],
  rationale: "A marca aparece por sinais genéricos.",
  insertionAngle: "A marca poderia entrar por rotina.",
  suggestedDeliverables: ["Stories"],
  suggestedApproachMessage: "Mensagem genérica.",
  disclaimer: "Marca sugerida por possível match narrativo.",
};

function makeMatch(index: number) {
  return {
    ...nikeMatch,
    brandId: `brand-${index}`,
    brandName: `Marca ${index}`,
    slug: `marca-${index}`,
    matchLevel: index % 2 === 0 ? "medio" : "alto",
    matchScore: index % 2 === 0 ? 0.56 : 0.82,
    matchedSignals: ["corrida", "preparação", "conquista", "performance"],
    suggestedDeliverables: ["1 Reels narrativo", "Stories de bastidores", "Recorte de aprendizado"],
  };
}

function mockFetch(payload: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: jest.fn().mockResolvedValue(payload),
  }) as jest.Mock;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createAbortError() {
  return typeof DOMException === "function"
    ? new DOMException("Aborted", "AbortError")
    : Object.assign(new Error("Aborted"), { name: "AbortError" });
}

function mockPendingMatchFetchRespectingAbort() {
  const deferred = createDeferred<unknown>();

  global.fetch = jest.fn((_url: string, init?: RequestInit) => {
    const signal = init?.signal;
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }

      signal?.addEventListener("abort", () => reject(createAbortError()), { once: true });

      deferred.promise.then((payload) => {
        resolve({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(payload),
        });
      }, reject);
    });
  }) as jest.Mock;

  return deferred;
}

describe("BrandNarrativeMatchesPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, "open", {
      configurable: true,
      value: jest.fn(() => ({})),
    });
  });

  it("loading termina após resposta 200 com matches []", async () => {
    mockFetch({ ok: true, matches: [] });

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    expect(screen.getByText("Buscando marcas com match narrativo...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Ainda não encontramos marcas com match narrativo forte para essa pauta.")).toBeInTheDocument();
    });

    expect(screen.getByText("Tente escolher uma pauta mais específica ou gerar o relatório depois com uma marca em mente.")).toBeInTheDocument();
    expect(screen.queryByText("Buscando marcas com match narrativo...")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar relatório/ })).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/brand-narratives/match",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"limit":6'),
      })
    );
  });

  it("loading termina após resposta 200 com matches", async () => {
    mockFetch({
      ok: true,
      matches: [
        {
          brandId: "brand-adidas",
          brandName: "Adidas",
          slug: "adidas",
          category: ["esporte", "corrida"],
          matchScore: 0.86,
          matchLevel: "alto",
          confidenceScore: 0.85,
          matchedSignals: ["corrida", "preparação", "conquista"],
          rationale: "A marca combina com a pauta pela mistura de corrida e preparação.",
          insertionAngle: "A marca pode entrar no kit e no treino pré-prova.",
          suggestedDeliverables: ["1 Reels narrativo", "Stories de bastidores"],
          suggestedApproachMessage: "Tenho uma narrativa orgânica para a marca.",
          disclaimer: "Marca sugerida por possível match narrativo.",
        },
      ],
    });

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Adidas")).toBeInTheDocument();
    });

    expect(screen.queryByText("Buscando marcas com match narrativo...")).not.toBeInTheDocument();
    expect(screen.getByText("alto")).toBeInTheDocument();
    expect(screen.getByText("Oportunidade")).toBeInTheDocument();
    expect(screen.getByText("A marca pode entrar no kit e no treino pré-prova.")).toBeInTheDocument();
    expect(screen.getByText(/Entregáveis:/)).toBeInTheDocument();
    expect(screen.getByText(/Reels narrativo/)).toBeInTheDocument();
    const reportButton = screen.getByRole("button", { name: /Gerar relatório/ });
    expect(reportButton).toBeInTheDocument();
    expect(reportButton).toHaveClass("!bg-zinc-950", "!text-white", "h-10");
    expect(track).toHaveBeenCalledWith("post_creation_brand_matches_loaded", { count: 1 });
  });

  it("envia categorias ricas quando disponíveis", async () => {
    mockFetch({ ok: true, matches: [] });

    render(<BrandNarrativeMatchesPanel categories={baseCategories} decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Ainda não encontramos marcas com match narrativo forte para essa pauta.")).toBeInTheDocument();
    });

    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody.categories).toEqual(expect.objectContaining({
      context: ["Estilo de Vida e Bem-Estar"],
      contentIntent: ["conectar"],
      contentSignals: ["autocuidado"],
    }));
  });

  it("não renderiza matches baixos e mostra empty state quando só há baixo", async () => {
    mockFetch({ ok: true, matches: [lowMatch] });

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Ainda não encontramos marcas com match narrativo forte para essa pauta.")).toBeInTheDocument();
    });

    expect(screen.queryByText("Mundo Verde")).not.toBeInTheDocument();
    expect(screen.queryByText("baixo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar relatório/ })).not.toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("post_creation_brand_matches_loaded", { count: 0 });
  });

  it("mantém matches médios e altos e filtra baixos na mesma resposta", async () => {
    mockFetch({
      ok: true,
      matches: [
        lowMatch,
        {
          ...nikeMatch,
          matchLevel: "medio",
          matchScore: 0.58,
        },
      ],
    });

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Nike")).toBeInTheDocument();
    });

    expect(screen.getByText("medio")).toBeInTheDocument();
    expect(screen.queryByText("Mundo Verde")).not.toBeInTheDocument();
    expect(screen.queryByText("baixo")).not.toBeInTheDocument();
    const reportButton = screen.getByRole("button", { name: /Gerar relatório/ });
    expect(reportButton).toBeInTheDocument();
    expect(reportButton).toHaveClass("!bg-zinc-950", "!text-white");
  });

  it("renderiza apenas 3 marcas inicialmente e permite expandir/recolher", async () => {
    mockFetch({
      ok: true,
      matches: [1, 2, 3, 4, 5].map(makeMatch),
    });

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Marca 1")).toBeInTheDocument();
    });

    expect(screen.getByText("Marca 2")).toBeInTheDocument();
    expect(screen.getByText("Marca 3")).toBeInTheDocument();
    expect(screen.queryByText("Marca 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Marca 5")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver mais marcas" }));

    expect(screen.getByText("Marca 4")).toBeInTheDocument();
    expect(screen.getByText("Marca 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver menos" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver menos" }));

    expect(screen.queryByText("Marca 4")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver mais marcas" })).toBeInTheDocument();
  });

  it("loading termina após erro 500", async () => {
    mockFetch({ ok: false, error: "Erro ao calcular marcas sugeridas." }, false);

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Não foi possível carregar marcas sugeridas agora.")).toBeInTheDocument();
    });

    expect(screen.queryByText("Buscando marcas com match narrativo...")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar relatório/ })).not.toBeInTheDocument();
  });

  it("loading termina após fetch rejeitado", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network failed")) as jest.Mock;

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Não foi possível carregar marcas sugeridas agora.")).toBeInTheDocument();
    });

    expect(screen.queryByText("Buscando marcas com match narrativo...")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar relatório/ })).not.toBeInTheDocument();
  });

  it("não faz loop de requests quando decision e pauta têm o mesmo conteúdo", async () => {
    const deferred = mockPendingMatchFetchRespectingAbort();

    const { rerender } = render(
      <BrandNarrativeMatchesPanel decision={{ ...baseDecision }} pauta={{ ...basePauta, keywords: [...basePauta.keywords] }} />
    );

    rerender(
      <BrandNarrativeMatchesPanel decision={{ ...baseDecision }} pauta={{ ...basePauta, keywords: [...basePauta.keywords] }} />
    );

    deferred.resolve({ ok: true, matches: [nikeMatch] });

    await waitFor(() => {
      expect(screen.getByText("Nike")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Buscando marcas com match narrativo...")).not.toBeInTheDocument();
  });

  it("não fica preso em loading quando React remonta o efeito em StrictMode", async () => {
    const deferred = mockPendingMatchFetchRespectingAbort();

    render(
      <StrictMode>
        <BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />
      </StrictMode>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    deferred.resolve({ ok: true, matches: [nikeMatch] });

    await waitFor(() => {
      expect(screen.getByText("Nike")).toBeInTheDocument();
    });

    expect(screen.queryByText("Buscando marcas com match narrativo...")).not.toBeInTheDocument();
  });

  it("o botão de relatório gera o relatório e abre a página pública", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, matches: [nikeMatch] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          ok: true,
          report: {
            id: "report-1",
            publicSlug: "br-test",
            publicUrl: "http://localhost:3000/brand-report/br-test",
          },
        }),
      }) as jest.Mock;

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Nike")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Gerar relatório/ }));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        "http://localhost:3000/brand-report/br-test",
        "_blank"
      );
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/brand-narratives/reports", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"brandName":"Nike"'),
    }));
    expect(track).toHaveBeenCalledWith("post_creation_brand_report_created", {
      brandName: "Nike",
      brandId: "brand-nike",
      matchLevel: "alto",
    });
  });

  it("não gera múltiplos relatórios para a mesma marca durante loading", async () => {
    let resolveReport!: (value: unknown) => void;
    const reportPromise = new Promise((resolve) => {
      resolveReport = resolve;
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, matches: [nikeMatch] }),
      })
      .mockReturnValueOnce(reportPromise) as jest.Mock;

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Nike")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /Gerar relatório/ });
    fireEvent.click(button);
    fireEvent.click(button);

    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => url === "/api/brand-narratives/reports")).toHaveLength(1);
    const loadingButton = screen.getByRole("button", { name: /Gerando relatório/ });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveClass("!bg-zinc-950", "!text-white", "disabled:cursor-wait");

    resolveReport({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        ok: true,
        report: {
          publicUrl: "http://localhost:3000/brand-report/br-test",
        },
      }),
    });

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith("http://localhost:3000/brand-report/br-test", "_blank");
    });
  });

  it("mostra erro e não abre nova aba quando a criação do relatório falha", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, matches: [nikeMatch] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ ok: false, error: "Erro ao criar relatório." }),
      }) as jest.Mock;

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Nike")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Gerar relatório/ }));

    await waitFor(() => {
      expect(screen.getByText("Não foi possível gerar o relatório agora. Tente novamente em alguns instantes.")).toBeInTheDocument();
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it("mostra link clicável quando a nova aba é bloqueada", async () => {
    (window.open as jest.Mock).mockReturnValueOnce(null);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, matches: [nikeMatch] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          ok: true,
          report: {
            publicUrl: "http://localhost:3000/brand-report/br-test",
          },
        }),
      }) as jest.Mock;

    render(<BrandNarrativeMatchesPanel decision={baseDecision} pauta={basePauta} />);

    await waitFor(() => {
      expect(screen.getByText("Nike")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Gerar relatório/ }));

    await waitFor(() => {
      expect(screen.getByText("Abrir relatório gerado")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Abrir relatório gerado" })).toHaveAttribute(
      "href",
      "http://localhost:3000/brand-report/br-test"
    );
  });
});
