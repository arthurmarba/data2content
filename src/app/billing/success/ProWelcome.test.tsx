import React from "react";
import { render, screen } from "@testing-library/react";

import { ProWelcome } from "./ProWelcome";

describe("ProWelcome independent activation actions", () => {
  it("mantém comunidade e Instagram disponíveis ao mesmo tempo", () => {
    render(<ProWelcome instagramConnected={false} continueHref="/dashboard/boards/mobile-strategic-profile" />);

    expect(screen.getByRole("link", { name: "Conectar meu Instagram" })).toHaveAttribute(
      "href",
      "/dashboard/instagram/connect?next=narrative-map",
    );
    expect(screen.getByRole("link", { name: "Entrar na Comunidade D2C" })).toHaveAttribute(
      "href",
      "/api/dashboard/community/pro-join",
    );
  });

  it("libera o convite rastreável do grupo quando o Instagram já está conectado", () => {
    render(<ProWelcome instagramConnected continueHref="/dashboard/boards/mobile-strategic-profile" />);

    expect(screen.queryByRole("link", { name: "Conectar meu Instagram" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar na Comunidade D2C" })).toHaveAttribute(
      "href",
      "/api/dashboard/community/pro-join",
    );
  });
});
