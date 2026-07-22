import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WhatsAppConnectInline from "./WhatsAppConnectInline";

describe("WhatsAppConnectInline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("permite desvincular um número e interromper os alertas", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ linked: true, phone: "5511999999999" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, linked: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    render(<WhatsAppConnectInline />);

    expect(
      await screen.findByText(/Conectado ao WhatsApp/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir WhatsApp para acessar o Chat AI" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Desvincular" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/whatsapp/status", {
        method: "DELETE",
      }),
    );
    expect(
      await screen.findByText("Gere seu código para vincular o WhatsApp."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Conectado ao WhatsApp/),
    ).not.toBeInTheDocument();
  });
});
