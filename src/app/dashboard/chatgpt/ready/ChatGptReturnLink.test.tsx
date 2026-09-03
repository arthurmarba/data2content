import { fireEvent, render, screen } from "@testing-library/react";

import { track } from "@/lib/track";
import { ChatGptReturnLink } from "./ChatGptReturnLink";

jest.mock("@/lib/track", () => ({ track: jest.fn() }));

describe("ChatGptReturnLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registra o retorno para a URL pública específica do plugin", () => {
    render(<ChatGptReturnLink href="https://chatgpt.com/apps/data2content" />);

    const link = screen.getByRole("link", {
      name: "Voltar e usar a Data2Content no ChatGPT",
    });
    expect(link).toHaveAttribute("href", "https://chatgpt.com/apps/data2content");

    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith(
      "chatgpt_funnel_event",
      expect.objectContaining({ step: "return_to_chatgpt_clicked" }),
    );
  });

  it("expõe o fallback e registra quando a URL do plugin não está configurada", () => {
    render(<ChatGptReturnLink href={null} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Voltar e usar a Data2Content no ChatGPT"))
      .toHaveAttribute("aria-disabled", "true");
    expect(track).toHaveBeenCalledWith(
      "chatgpt_funnel_event",
      expect.objectContaining({
        step: "return_to_chatgpt_unavailable",
        status: "plugin_url_not_configured",
      }),
    );
  });
});
