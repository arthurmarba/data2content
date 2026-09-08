import { redirect } from "next/navigation";
import LegacyWhatsAppRedirect from "./page";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("LegacyWhatsAppRedirect", () => {
  it("leva o endereço antigo para o hub sem apontar uma seção oculta", () => {
    LegacyWhatsAppRedirect();

    expect(redirect).toHaveBeenCalledWith(
      "/dashboard/instagram-connection",
    );
  });
});
