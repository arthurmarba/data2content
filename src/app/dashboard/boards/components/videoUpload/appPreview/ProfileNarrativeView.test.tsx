import { fireEvent, render, screen, within } from "@testing-library/react";

import type { IMapaData } from "@/app/models/MapaSeed";

import { ProfileNarrativeView, subjectsNotSeen } from "./ProfileNarrativeView";

const MAPA = {
  narrativa_central: "Você fala de maternidade sem idealização",
  territorios: ["Maternidade", "Trabalho e culpa"],
  temas: ["Culpa materna"],
  narrativas_adjacentes: ["Corpo pós-parto"],
  assets: ["Cozinha de manhã"],
  tom: "",
  formatos: [],
  maturidade: "seed",
  fonte: ["onboarding_declarativo"],
} as unknown as IMapaData;

function renderView(overrides: Partial<Parameters<typeof ProfileNarrativeView>[0]> = {}) {
  const onMapaChange = jest.fn();
  const onClose = jest.fn();
  render(
    <ProfileNarrativeView
      mapa={MAPA}
      narrative={MAPA.narrativa_central}
      observedSubjects={["Maternidade"]}
      coverageLine="Atualizada a partir de 71 de 84 posts lidos nos últimos 90 dias."
      onClose={onClose}
      onMapaChange={onMapaChange}
      {...overrides}
    />,
  );
  return { onMapaChange, onClose };
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
});

describe("a narrativa por inteiro", () => {
  it("mostra as quatro camadas na ordem da cadeia de evidência", () => {
    renderView();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(titles.slice(0, 4)).toEqual(["Territórios", "Assuntos", "Adjacências", "Da sua vida"]);
  });

  it("adiciona um chip com otimismo e grava na mesma rota do mapa", () => {
    const { onMapaChange } = renderView();
    const territorios = screen.getByRole("region", { name: "Territórios" });

    fireEvent.click(within(territorios).getByRole("button", { name: "+ adicionar" }));
    fireEvent.change(within(territorios).getByRole("textbox", { name: "Adicionar em Territórios" }), {
      target: { value: "Casa e rotina" },
    });
    fireEvent.click(within(territorios).getByRole("button", { name: "salvar" }));

    expect(onMapaChange).toHaveBeenCalledTimes(1);
    expect(onMapaChange.mock.calls[0]![0].territorios).toEqual([
      "Maternidade",
      "Trabalho e culpa",
      "Casa e rotina",
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/dashboard/mobile-strategic-profile/map-seed",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("remove um chip pela seção certa", () => {
    const { onMapaChange } = renderView();
    const adjacencias = screen.getByRole("region", { name: "Adjacências" });
    fireEvent.click(within(adjacencias).getByRole("button", { name: "Remover Corpo pós-parto" }));

    expect(onMapaChange.mock.calls[0]![0].narrativas_adjacentes).toEqual([]);
    // As outras camadas não são tocadas por uma remoção em adjacências.
    expect(onMapaChange.mock.calls[0]![0].territorios).toEqual(["Maternidade", "Trabalho e culpa"]);
  });

  it("desiste da adição no Esc, sem gravar nada", () => {
    const { onMapaChange } = renderView();
    const temas = screen.getByRole("region", { name: "Assuntos" });
    fireEvent.click(within(temas).getByRole("button", { name: "+ adicionar" }));
    fireEvent.keyDown(within(temas).getByRole("textbox", { name: "Adicionar em Assuntos" }), { key: "Escape" });

    expect(onMapaChange).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("nomeia a distância entre o que foi declarado e o que os vídeos mostram", () => {
    // O card do Perfil passou a mostrar só os assuntos OBSERVADOS. A lacuna —
    // o que ela diz que fala e nenhum vídeo confirmou — vive aqui, ou some.
    renderView();
    const lacuna = screen.getByRole("region", { name: "O que não aparece" });
    expect(within(lacuna).getByText(/Trabalho e culpa/)).toBeInTheDocument();
    expect(within(lacuna).getByText(/nenhum vídeo lido falou/)).toBeInTheDocument();
  });

  it("conta as lacunas que não couberam na frase, em vez de calar sobre elas", () => {
    renderView({
      mapa: { ...MAPA, temas: ["A", "B", "C", "D", "E"] } as IMapaData,
      observedSubjects: ["Maternidade"],
    });
    const lacuna = screen.getByRole("region", { name: "O que não aparece" });
    // 5 temas + "Trabalho e culpa" = 6 lacunas; três aparecem, três são contadas.
    expect(within(lacuna).getByText(/e mais 3/)).toBeInTheDocument();
  });

  it("não acusa lacuna quando ainda não houve leitura nenhuma", () => {
    // Sem leitura, tudo estaria "não visto" — acusar lacuna aí seria acusar o
    // produto de não ter rodado ainda, não a criadora de não ter postado.
    renderView({ observedSubjects: [], mapa: { ...MAPA, temas: [], territorios: [] } as IMapaData });
    const lacuna = screen.getByRole("region", { name: "O que não aparece" });
    expect(
      within(lacuna).getByText("Nenhum vídeo foi lido ainda, então não dá para dizer o que falta."),
    ).toBeInTheDocument();
  });

  it("trava a rolagem do fundo enquanto está aberta", () => {
    renderView();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("prende o foco no diálogo e o devolve ao elemento que o abriu", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <ProfileNarrativeView
        mapa={MAPA}
        narrative={MAPA.narrativa_central}
        observedSubjects={["Maternidade"]}
        coverageLine={null}
        onClose={jest.fn()}
        onMapaChange={jest.fn()}
      />,
    );
    const panel = screen.getByRole("dialog").firstChild as HTMLElement;
    expect(document.activeElement).toBe(panel);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).not.toBe(opener);
    expect(panel.contains(document.activeElement)).toBe(true);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("volta para o Perfil no botão e no Esc", () => {
    const { onClose } = renderView();
    fireEvent.click(screen.getByRole("button", { name: "Perfil" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("subjectsNotSeen", () => {
  it("casa por palavra inteira, ignorando acento e caixa", () => {
    expect(subjectsNotSeen(["Maternidade", "Fé"], ["maternidade sem idealização"])).toEqual(["Fé"]);
  });

  it("não dá um assunto por visto porque o nome dele cabe dentro de outra palavra", () => {
    // "fé" está dentro de "café"; "a" está dentro de qualquer coisa. Com o
    // `includes` cru os dois sumiriam da lacuna sem nunca terem aparecido.
    expect(subjectsNotSeen(["Fé"], ["Café da manhã"])).toEqual(["Fé"]);
    expect(subjectsNotSeen(["A", "Casa"], ["Maternidade"])).toEqual(["A", "Casa"]);
  });

  it("devolve tudo quando não houve leitura", () => {
    expect(subjectsNotSeen(["Maternidade"], [])).toEqual(["Maternidade"]);
  });
});
