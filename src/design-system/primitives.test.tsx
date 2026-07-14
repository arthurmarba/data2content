import { fireEvent, render, screen } from "@testing-library/react";
import { BottomSheet, Button } from "./primitives";

describe("creator-studio primitives", () => {
  it("aplica a variante semântica do botão", () => {
    render(<Button variant="primary">Continuar</Button>);
    expect(screen.getByRole("button", { name: "Continuar" })).toHaveClass("ds-button--primary");
  });

  it("fecha o sheet com Escape e restaura o contrato de diálogo", () => {
    const onClose = jest.fn();
    render(<BottomSheet open title="Pauta" onClose={onClose}><p>Conteúdo</p></BottomSheet>);
    expect(screen.getByRole("dialog", { name: "Pauta" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("não monta o sheet fechado", () => {
    render(<BottomSheet open={false} title="Pauta" onClose={() => {}}><p>Conteúdo</p></BottomSheet>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
