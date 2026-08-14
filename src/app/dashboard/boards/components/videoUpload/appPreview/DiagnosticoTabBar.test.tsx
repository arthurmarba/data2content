import { fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticoTabBar } from "./DiagnosticoTabBar";

describe("DiagnosticoTabBar", () => {
  it("expõe navegação e ação central com alvos acessíveis", () => {
    const onSelectPerfil = jest.fn();
    const onSelectCollabs = jest.fn();
    const onPressPlus = jest.fn();

    const { container } = render(
      <DiagnosticoTabBar
        activeTab="collabs"
        onSelectPerfil={onSelectPerfil}
        onSelectCollabs={onSelectCollabs}
        onPressPlus={onPressPlus}
      />,
    );

    expect(screen.getByRole("button", { name: "Collabs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Perfil" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByText("Escanear")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegação do Perfil" })).toHaveClass("bg-[var(--ds-color-paper)]");
    expect(container.querySelector("nav")).not.toHaveClass("shadow-lg");

    fireEvent.click(screen.getByRole("button", { name: "Perfil" }));
    fireEvent.click(screen.getByRole("button", { name: "Collabs" }));
    fireEvent.click(screen.getByRole("button", { name: "Analisar conteúdo" }));

    expect(onSelectPerfil).toHaveBeenCalledTimes(1);
    expect(onSelectCollabs).toHaveBeenCalledTimes(1);
    expect(onPressPlus).toHaveBeenCalledTimes(1);
  });
});
