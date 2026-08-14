import { fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticoWhatsAppSheet } from "./DiagnosticoWhatsAppSheet";

jest.mock("@/app/dashboard/WhatsAppConnectInline", () => ({
  __esModule: true,
  default: () => <div>Conexão do WhatsApp</div>,
}));

describe("DiagnosticoWhatsAppSheet", () => {
  it("usa o sheet e os controles canônicos do Perfil mobile", () => {
    const onClose = jest.fn();
    render(<DiagnosticoWhatsAppSheet onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Vincular WhatsApp" })).toHaveClass("ds-sheet");
    expect(screen.getByText("Receber pautas no WhatsApp")).toHaveClass("text-[var(--ds-color-ink)]");
    expect(screen.getByText("Conexão do WhatsApp")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Fechar" });
    expect(closeButton).toHaveClass("ds-icon-button");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
