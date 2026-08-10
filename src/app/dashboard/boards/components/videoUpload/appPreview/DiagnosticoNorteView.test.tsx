import { fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticoNorteView } from "./DiagnosticoNorteView";

describe("DiagnosticoNorteView", () => {
  it("reúne propósito e mapa atual na mesma área de configuração", () => {
    const onEditMap = jest.fn();

    const { container } = render(
      <DiagnosticoNorteView
        initialPurpose="Ajudar criadores a trabalharem com mais leveza"
        mapNarrative="Rotina criativa sem perfeccionismo"
        mapTerritories={["Bastidores", "Produtividade leve"]}
        onClose={jest.fn()}
        onEditMap={onEditMap}
      />,
    );

    expect(screen.getByDisplayValue("Ajudar criadores a trabalharem com mais leveza")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Rotina criativa sem perfeccionismo/ })).toBeInTheDocument();
    expect(screen.getByText("Bastidores")).toBeInTheDocument();
    expect(screen.getByText("Produtividade leve")).toBeInTheDocument();
    expect(container.querySelectorAll(".ds-editorial-panel")).toHaveLength(0);
    expect(container.querySelectorAll(".ds-notebook-section .ds-notebook-section")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Ajustar respostas do mapa" }));
    expect(onEditMap).toHaveBeenCalledTimes(1);
  });
});
