import { fireEvent, render, screen, within } from "@testing-library/react";

import { CREATOR_WEEKLY_REPORT_DEMO } from "@/app/lib/creatorWeeklyReport/demoReport";
import { buildPatternHighlights } from "@/app/lib/creatorWeeklyReport/patternHighlights";
import { patternTrendKey, type PatternContext } from "@/app/lib/creatorWeeklyReport/patternContextTypes";

import { ProfilePatternDetailSheet } from "./ProfilePatternDetailSheet";

const highlights = buildPatternHighlights(CREATOR_WEEKLY_REPORT_DEMO);
const place = highlights.find((highlight) => highlight.groupId === "place")!;
const placeDetail = CREATOR_WEEKLY_REPORT_DEMO.details.find((detail) => detail.id === "scene")!;

const CONTEXT: PatternContext = {
  weeks: 4,
  trends: {
    [patternTrendKey("scene", "place", "Natureza")!]: [0, 0, 0, 7.5],
  },
  territory: {
    id: "maternidade",
    label: "Maternidade",
    weekKey: "2026-W33",
    rankings: {
      place: [
        { key: "kitchen", label: "Cozinha de casa", index: 2.1 },
        { key: "nature", label: "Natureza", index: 1.9 },
        { key: "beach", label: "Praia", index: 1.6 },
      ],
    },
  },
};

function renderSheet(context: PatternContext | null) {
  return render(
    <ProfilePatternDetailSheet
      highlight={place}
      detail={placeDetail}
      context={context}
      onClose={jest.fn()}
    />,
  );
}

describe("o detalhe de um padrão", () => {
  it("põe o ranking do criador e o do território lado a lado, na mesma régua", () => {
    renderSheet(CONTEXT);
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveClass("z-[300]");
    expect(within(dialog).getByRole("heading", { name: "Grave em natureza" })).toBeInTheDocument();
    expect(within(dialog).getByText("Seu ranking")).toBeInTheDocument();
    // A coluna do território leva o nome do território, não a palavra genérica.
    expect(within(dialog).getByText("Maternidade")).toBeInTheDocument();
    expect(within(dialog).getByText("Cozinha de casa")).toBeInTheDocument();
    expect(within(dialog).getByText("2,1×")).toBeInTheDocument();
  });

  it("escreve o veredito com os dois números dentro", () => {
    renderSheet(CONTEXT);
    const dialog = screen.getByRole("dialog");

    // Natureza: 7,5× em um post só contra 1,9× no território. A distância é
    // grande demais para a amostra — o card manda repetir antes de virar regra.
    expect(within(dialog).getByText("O território não explica seu número")).toBeInTheDocument();
    expect(within(dialog).getByText(/Repita antes de tratar como regra/)).toBeInTheDocument();
  });

  it("diz que falta leitura do território em vez de sumir com a coluna", () => {
    renderSheet(null);
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText("Seu ranking")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Ainda não há leitura do seu território para comparar este padrão."),
    ).toBeInTheDocument();
  });

  it("lê a série da semana em palavras, além das barrinhas", () => {
    renderSheet(CONTEXT);
    // Apareceu uma vez só nas quatro semanas: repetir é o que vira leitura.
    expect(screen.getByText(/apareceu uma vez só nas últimas 4 semanas/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Últimas 4 semanas" })).toBeInTheDocument();
  });

  it("fecha no Esc", () => {
    const onClose = jest.fn();
    render(
      <ProfilePatternDetailSheet
        highlight={place}
        detail={placeDetail}
        context={CONTEXT}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("trava a rolagem do fundo e devolve o foco ao fechar", () => {
    // Overlay que deixa o fundo rolar por baixo é overlay pela metade — e no
    // celular é o bug que a pessoa sente primeiro.
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rerender } = render(
      <ProfilePatternDetailSheet
        highlight={place}
        detail={placeDetail}
        context={CONTEXT}
        onClose={jest.fn()}
      />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    // O foco entra no painel, e não fica no card escondido atrás dele.
    expect(screen.getByRole("dialog").firstChild).toBe(document.activeElement);

    rerender(
      <ProfilePatternDetailSheet highlight={null} detail={null} context={CONTEXT} onClose={jest.fn()} />,
    );
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("não existe enquanto nenhum padrão foi aberto", () => {
    render(
      <ProfilePatternDetailSheet highlight={null} detail={null} context={CONTEXT} onClose={jest.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
