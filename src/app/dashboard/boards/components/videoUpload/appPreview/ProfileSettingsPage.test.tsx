import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProfileSettingsPage } from "./ProfileSettingsPage";

describe("ProfileSettingsPage", () => {
  it("aplica o caderno visual do Perfil e oferece retorno por link", () => {
    render(
      <ProfileSettingsPage title="Últimas análises" backHref="/dashboard/boards/mobile-strategic-profile">
        <p>Conteúdo</p>
      </ProfileSettingsPage>,
    );

    const page = screen.getByText("Conteúdo").closest("main");
    expect(page).toHaveClass("d2c-mobile-app", "ds-notebook");
    expect(page).toHaveAttribute("data-profile-settings-page", "true");
    expect(screen.getByRole("heading", { name: "Últimas análises" })).toHaveClass("font-display");
    expect(screen.getByRole("link", { name: "Voltar ao Perfil" })).toHaveAttribute(
      "href",
      "/dashboard/boards/mobile-strategic-profile",
    );
  });

  it("usa callback de retorno quando a tela vive dentro de um fluxo", () => {
    const onBack = jest.fn();
    render(
      <ProfileSettingsPage title="Conectar Instagram" onBack={onBack} backLabel="Voltar ao mapa">
        <p>Conexão</p>
      </ProfileSettingsPage>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao mapa" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
