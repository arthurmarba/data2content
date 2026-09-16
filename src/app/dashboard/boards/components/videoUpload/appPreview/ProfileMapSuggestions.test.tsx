import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { IMapaData } from "@/app/models/MapaSeed";

import { ProfileMapSuggestions } from "./ProfileMapSuggestions";

const TOM = {
  id: "instagram:tom:abc:0",
  section: "tom",
  value: "Direto",
  previousValue: "Direto e instrutivo, Pessoal e entusiasmado",
  reason: "As leituras sugerem uma mudança. Sua escolha atual foi preservada.",
  state: "pending",
  evidence: [{ id: "p1", url: "https://instagram.com/p/1" }, { id: "p2" }],
  revisions: ["r1"],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
  source: "instagram",
};

const TEMA = {
  ...TOM,
  id: "instagram:temas:abc:1",
  section: "temas",
  value: "Colaborações",
  previousValue: null,
  reason: "Identificado nas leituras; disponível para adicionar ao seu mapa.",
  state: "observing",
  evidence: [],
};

function mapa(overrides: Record<string, unknown> = {}): IMapaData {
  return {
    narrativa_central: "Você fala de maternidade sem idealização",
    tom: "Direto e instrutivo, Pessoal e entusiasmado",
    territorios: ["Maternidade"],
    temas: [],
    narrativas_adjacentes: [],
    assets: [],
    formatos: [],
    observacoes: [],
    suggestions: [TOM, TEMA],
    ...overrides,
  } as unknown as IMapaData;
}

/** O GET de abertura não traz mapa; só o POST da decisão responde com um. */
function mockFetch(postBody: unknown = { mapa: { tom: "Direto" } }, postOk = true) {
  const fetchMock = jest.fn((_url: string, options?: RequestInit) =>
    options?.method === "POST"
      ? Promise.resolve({ ok: postOk, json: async () => postBody })
      : Promise.resolve({ ok: true, json: async () => ({}) }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function renderSuggestions(data: IMapaData | null = mapa()) {
  const onMapaChange = jest.fn();
  render(<ProfileMapSuggestions mapa={data} onMapaChange={onMapaChange} />);
  return { onMapaChange };
}

const card = () => screen.getByRole("article");

beforeEach(() => {
  mockFetch();
});

describe("sugestões do mapa, uma por vez", () => {
  it("mostra UMA sugestão, não a fila toda", () => {
    // Em lista, cada sugestão repetia as quatro ações: com quatro sugestões,
    // dezesseis controles na tela. É a origem da poluição.
    renderSuggestions();

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Aceitar" })).toHaveLength(1);
    // A segunda sugestão não está na tela — `getByText` lançaria, então a
    // consulta tem que ser a que aceita ausência.
    expect(screen.queryByText("Colaborações")).toBeNull();
  });

  it("diz qual dimensão é e em que ponto da fila você está", () => {
    renderSuggestions();
    expect(within(card()).getByText("Tom de voz")).toBeInTheDocument();
    expect(within(card()).getByText("1 de 2")).toBeInTheDocument();
  });

  it("põe o valor sugerido como manchete e o atual como legenda", () => {
    renderSuggestions();
    expect(within(card()).getByText("Direto")).toBeInTheDocument();
    expect(within(card()).getByText(/^hoje: Direto e instrutivo/)).toBeInTheDocument();
  });

  it("deixa à vista apenas Aceitar e Depois", () => {
    renderSuggestions();
    const visiveis = within(card())
      .getAllByRole("button")
      .map((node) => node.getAttribute("aria-label") ?? node.textContent);
    expect(visiveis).toEqual(["Aceitar", "Depois", "Mais opções"]);
  });

  it("avança para a próxima sugestão em 'Depois', sem gravar decisão", () => {
    const fetchMock = mockFetch();
    renderSuggestions();

    fireEvent.click(within(card()).getByRole("button", { name: "Depois" }));

    // A segunda é da seção `temas`, que se chama "Assuntos" na tela.
    expect(within(card()).getByText("Assuntos")).toBeInTheDocument();
    expect(within(card()).getByText("Colaborações")).toBeInTheDocument();
    // A contagem anda junto: segunda de duas.
    expect(within(card()).getByText("2 de 2")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("aceita a sugestão e devolve o mapa que o servidor gravou", async () => {
    const fetchMock = mockFetch({ mapa: { tom: "Direto" } });
    const { onMapaChange } = renderSuggestions();

    await act(async () => {
      fireEvent.click(within(card()).getByRole("button", { name: "Aceitar" }));
    });

    const post = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      id: TOM.id,
      action: "accept",
      expectedUpdatedAt: TOM.updatedAt,
    });
    expect(onMapaChange).toHaveBeenCalledWith({ tom: "Direto" });
  });

  it("guarda recusar, editar e a prova atrás de um toque", () => {
    renderSuggestions();
    expect(within(card()).queryByRole("button", { name: "Não usar esta sugestão" })).toBeNull();
    expect(within(card()).queryByText(/Ver as 2 leituras/)).toBeNull();

    fireEvent.click(within(card()).getByRole("button", { name: "Mais opções" }));

    expect(within(card()).getByRole("button", { name: "Editar antes de aceitar" })).toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: "Não usar esta sugestão" })).toBeInTheDocument();
    expect(within(card()).getByText("Ver as 2 leituras que sugeriram isso")).toBeInTheDocument();
  });

  it("recusa a sugestão pela gaveta, mantendo o que já estava", async () => {
    const fetchMock = mockFetch({ mapa: { tom: "Direto e instrutivo" } });
    renderSuggestions();

    fireEvent.click(within(card()).getByRole("button", { name: "Mais opções" }));
    await act(async () => {
      fireEvent.click(within(card()).getByRole("button", { name: "Não usar esta sugestão" }));
    });

    const post = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body)).action).toBe("dismiss");
  });

  it("deixa escrever a própria versão e envia o texto editado", async () => {
    const fetchMock = mockFetch({ mapa: { tom: "Do meu jeito" } });
    renderSuggestions();

    fireEvent.click(within(card()).getByRole("button", { name: "Mais opções" }));
    fireEvent.click(within(card()).getByRole("button", { name: "Editar antes de aceitar" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Escreva do seu jeito/ }), {
      target: { value: "Do meu jeito" },
    });
    await act(async () => {
      fireEvent.click(within(card()).getByRole("button", { name: "Salvar" }));
    });

    const post = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body)).value).toBe("Do meu jeito");
  });

  it("explica o que acontece quando não há valor atual para comparar", () => {
    renderSuggestions(mapa({ suggestions: [TEMA] }));
    expect(screen.getByText("entra na sua lista, sem tirar nada")).toBeInTheDocument();
  });

  it("marca a sugestão que ainda é observação inicial", () => {
    renderSuggestions(mapa({ suggestions: [TEMA] }));
    expect(screen.getByText("Ainda é observação inicial.")).toBeInTheDocument();
  });

  it("recolhe as observações numa linha, que abre a um toque", () => {
    renderSuggestions(
      mapa({ suggestions: [], observacoes: ["Seu tom no Instagram aparece como \"Direto\".", "Carrossel não apareceu."] }),
    );

    expect(screen.queryByText(/Carrossel não apareceu/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /A leitura observou 2 coisas/ }));
    expect(screen.getByText(/Carrossel não apareceu/)).toBeInTheDocument();
  });

  it("avisa quando o servidor recusa a gravação", async () => {
    mockFetch({ message: "Sugestão desatualizada." }, false);
    renderSuggestions();

    await act(async () => {
      fireEvent.click(within(card()).getByRole("button", { name: "Aceitar" }));
    });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Sugestão desatualizada."));
  });

  it("não ocupa a tela quando não há nada para revisar", () => {
    renderSuggestions(mapa({ suggestions: [], observacoes: [] }));
    expect(screen.queryByLabelText("Sugestões para revisar")).toBeNull();
  });

  it("não oferece sugestão de tom que já é o tom atual", () => {
    // A decisão já foi tomada: repetir a pergunta faria a tela parecer travada.
    renderSuggestions(mapa({ tom: "Direto", suggestions: [TOM] }));
    expect(screen.queryByRole("article")).toBeNull();
  });
});
