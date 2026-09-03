import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { canAccessPremiumContent } from "@/app/lib/community/recordedMeetingsAccess";
import UserModel from "@/app/models/User";
import { GET } from "./route";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({ resolveAuthOptions: jest.fn().mockResolvedValue({}) }));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/app/lib/community/recordedMeetingsAccess", () => ({
  canAccessPremiumContent: jest.fn(),
}));
jest.mock("@/app/lib/community/communityInvite.server", () => ({
  getCommunityWhatsAppUrl: () => "https://chat.whatsapp.com/pro-test",
}));
jest.mock("@/app/lib/logger", () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { updateOne: jest.fn() },
}));

const updateOne = UserModel.updateOne as unknown as jest.Mock;
const canAccess = canAccessPremiumContent as jest.Mock;

describe("GET /api/dashboard/community/pro-join", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1" } });
    canAccess.mockResolvedValue(true);
    updateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("registra a abertura do convite sem afirmar que a pessoa entrou no grupo", async () => {
    const response = await GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://chat.whatsapp.com/pro-test");
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "user_1" },
      { $set: { whatsappGroupLinkOpenedAt: expect.any(Date) } },
    );
    expect(JSON.stringify(updateOne.mock.calls)).not.toContain("whatsappGroupMember");
  });

  it("preserva o retorno quando a sessão não existe", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET(new NextRequest(
      "http://localhost/api/dashboard/community/pro-join?source=chatgpt",
    ));

    expect(response.headers.get("location")).toContain("/login?callbackUrl=");
    expect(response.headers.get("location")).toContain(
      encodeURIComponent("/api/dashboard/community/pro-join?source=chatgpt"),
    );
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("não revela o convite nem registra abertura para usuário Free", async () => {
    canAccess.mockResolvedValue(false);

    const response = await GET(new NextRequest(
      "http://localhost/api/dashboard/community/pro-join?source=chatgpt",
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard/profile");
    expect(response.headers.get("location")).toContain("d2c_paywall_context=community");
    expect(response.headers.get("location")).toContain("source=chatgpt");
    expect(response.headers.get("location")).not.toBe("https://chat.whatsapp.com/pro-test");
    expect(updateOne).not.toHaveBeenCalled();
  });
});
