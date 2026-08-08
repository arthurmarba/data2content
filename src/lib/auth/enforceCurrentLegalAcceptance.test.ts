import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { enforceCurrentLegalAcceptance } from "./enforceCurrentLegalAcceptance";

jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  getServerSession: jest.fn(),
}));
jest.mock("next/headers", () => ({ headers: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { findById: jest.fn(), findByIdAndUpdate: jest.fn() },
}));

const getServerSessionMock = getServerSession as jest.Mock;
const headersMock = headers as jest.Mock;
const redirectMock = redirect as unknown as jest.Mock;

describe("enforceCurrentLegalAcceptance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSessionMock.mockResolvedValue(null);
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("envia uma sessão ausente ao login e preserva a rota acessada", async () => {
    headersMock.mockResolvedValue({
      get: jest.fn().mockReturnValue("/dashboard/collabs?from=home"),
    });

    await expect(enforceCurrentLegalAcceptance("/dashboard")).rejects.toThrow(
      "NEXT_REDIRECT:/login?callbackUrl=%2Fdashboard%2Fcollabs%3Ffrom%3Dhome",
    );
  });

  it("recusa callback externo e usa o fallback interno", async () => {
    headersMock.mockResolvedValue({
      get: jest.fn().mockReturnValue("https://example.com/phishing"),
    });

    await expect(enforceCurrentLegalAcceptance("/dashboard")).rejects.toThrow(
      "NEXT_REDIRECT:/login?callbackUrl=%2Fdashboard",
    );
  });
});
