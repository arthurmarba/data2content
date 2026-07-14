import { fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticoTabBar } from "./DiagnosticoTabBar";

describe("DiagnosticoTabBar", () => {
  it("expõe navegação e ação central com alvos acessíveis", () => {
    const onSelectPerfil = jest.fn();
    const onSelectCollabs = jest.fn();
    const onPressPlus = jest.fn();

    render(
      <DiagnosticoTabBar
        activeTab="collabs"
        onSelectPerfil={onSelectPerfil}
        onSelectCollabs={onSelectCollabs}
        onPressPlus={onPressPlus}
      />,
    );

    expect(screen.getByRole("button", { name: "Collabs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Perfil" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Escanear")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Perfil" }));
    fireEvent.click(screen.getByRole("button", { name: "Collabs" }));
    fireEvent.click(screen.getByRole("button", { name: "Escanear novo vídeo" }));

    expect(onSelectPerfil).toHaveBeenCalledTimes(1);
    expect(onSelectCollabs).toHaveBeenCalledTimes(1);
    expect(onPressPlus).toHaveBeenCalledTimes(1);
  });
});
