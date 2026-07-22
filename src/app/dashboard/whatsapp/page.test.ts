import { redirect } from "next/navigation";
import LegacyWhatsAppRedirect from "./page";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("LegacyWhatsAppRedirect", () => {
  it("leva o endereço antigo para a seção de WhatsApp do hub de conexões", () => {
    LegacyWhatsAppRedirect();

    expect(redirect).toHaveBeenCalledWith(
      "/dashboard/instagram-connection#whatsapp",
    );
  });
});
