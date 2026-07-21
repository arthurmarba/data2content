import { fireEvent, render, screen } from "@testing-library/react";
import { StableCreatorAvatar } from "./StableCreatorAvatar";

describe("StableCreatorAvatar", () => {
  it("usa a rota interna do mídia kit e mantém as iniciais até a foto carregar", () => {
    const { container } = render(
      <div style={{ position: "relative", width: 40, height: 40 }}>
        <StableCreatorAvatar
          name="Marina Braga"
          avatarUrl="https://example.com/old.jpg"
          mediaKitSlug="marina-kit"
        />
      </div>,
    );

    expect(screen.getByText("M")).toBeVisible();
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", "/api/mediakit/marina-kit/avatar?v=20260719-collab-avatar-v4");

    fireEvent.load(image!);
    expect(screen.getByText("M")).toHaveStyle({ opacity: "0" });
  });

  it("mantém as iniciais e remove a imagem quando o carregamento falha", () => {
    const { container } = render(
      <div style={{ position: "relative", width: 40, height: 40 }}>
        <StableCreatorAvatar name="Théo" avatarUrl="https://example.com/avatar.jpg" />
      </div>,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(screen.getByText("T")).toBeVisible();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
