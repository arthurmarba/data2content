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

const cards = () => screen.getAllByRole("article");

beforeEach(() => {
  mockFetch();
});

describe("sugestões do mapa", () => {
  it("diz QUAL dimensão está sendo sugerida, não só o valor novo", () => {
    // Sem o rótulo, "Direto" sozinho não informa que a sugestão é sobre o tom.
    renderSuggestions();
    expect(within(cards()[0]!).getByText("Tom de voz")).toBeInTheDocument();
    expect(within(cards()[1]!).getByText("Assuntos")).toBeInTheDocument();
  });

  it("põe o valor atual e o sugerido lado a lado, cada um com seu rótulo", () => {
    renderSuggestions();
    const tom = cards()[0]!;
    expect(within(tom).getByText("Hoje")).toBeInTheDocument();
    expect(within(tom).getByText("Direto e instrutivo, Pessoal e entusiasmado")).toBeInTheDocument();
    expect(within(tom).getByText("Sugerido")).toBeInTheDocument();
    expect(within(tom).getByText("Direto")).toBeInTheDocument();
  });

  it("chama de adicionar, não de trocar, o que entra numa lista", () => {
    renderSuggestions();
    const tema = cards()[1]!;
    expect(within(tema).getByText("Adicionar")).toBeInTheDocument();
    expect(within(tema).queryByText("Hoje")).toBeNull();
  });

  it("marca a sugestão que ainda é observação inicial", () => {
    renderSuggestions();
    expect(within(cards()[1]!).getByText("observação inicial")).toBeInTheDocument();
    expect(within(cards()[0]!).queryByText("observação inicial")).toBeNull();
  });

  it("aceita a sugestão e devolve o mapa que o servidor gravou", async () => {
    const fetchMock = mockFetch({ mapa: { tom: "Direto" } });
    const { onMapaChange } = renderSuggestions();

    await act(async () => {
      fireEvent.click(within(cards()[0]!).getByRole("button", { name: "Aceitar" }));
    });

    const post = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      id: TOM.id,
      action: "accept",
      expectedUpdatedAt: TOM.updatedAt,
    });
    expect(onMapaChange).toHaveBeenCalledWith({ tom: "Direto" });
  });

  it("deixa escrever a própria versão e envia o texto editado", async () => {
    const fetchMock = mockFetch({ mapa: { tom: "Do meu jeito" } });
    renderSuggestions();

    fireEvent.click(within(cards()[0]!).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Escreva do seu jeito/ }), {
      target: { value: "Do meu jeito" },
    });
    await act(async () => {
      fireEvent.click(within(cards()[0]!).getByRole("button", { name: "Salvar minha versão" }));
    });

    const post = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body)).value).toBe("Do meu jeito");
  });

  it("recusa a sugestão mantendo o que já estava", async () => {
    const fetchMock = mockFetch({ mapa: { tom: "Direto e instrutivo" } });
    renderSuggestions();

    await act(async () => {
      fireEvent.click(within(cards()[0]!).getByRole("button", { name: "Manter como está" }));
    });

    const post = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body)).action).toBe("dismiss");
  });

  it("adia sem gravar decisão nenhuma", () => {
    const fetchMock = mockFetch();
    renderSuggestions();
    expect(cards()).toHaveLength(2);

    fireEvent.click(within(cards()[0]!).getByRole("button", { name: "Ver depois" }));

    expect(cards()).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("guarda a evidência fechada e abre a um toque", () => {
    renderSuggestions();
    const tom = cards()[0]!;
    expect(within(tom).queryByRole("link", { name: "Post 1" })).toBeNull();

    fireEvent.click(within(tom).getByRole("button", { name: /Ver as 2 leituras/ }));

    expect(within(tom).getByRole("link", { name: "Post 1" })).toHaveAttribute(
      "href",
      "https://instagram.com/p/1",
    );
    // Leitura de vídeo não tem link para abrir: aparece nomeada, sem virar link.
    expect(within(tom).getByText("Vídeo 2")).toBeInTheDocument();
  });

  it("separa observação de decisão, sem pedir toque para ela", () => {
    renderSuggestions(
      mapa({ suggestions: [], observacoes: ["Seu tom no Instagram aparece como \"Direto\"."] }),
    );
    expect(screen.getByText("O que a leitura observou")).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("avisa quando o servidor recusa a gravação", async () => {
    mockFetch({ message: "Sugestão desatualizada." }, false);
    renderSuggestions();

    await act(async () => {
      fireEvent.click(within(cards()[0]!).getByRole("button", { name: "Aceitar" }));
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
