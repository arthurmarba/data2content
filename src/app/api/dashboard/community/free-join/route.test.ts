import { GET } from "./route";
import { getServerSession } from "next-auth";
import UserModel from "@/app/models/User";
import { COMMUNITY_FREE_WHATSAPP_URL, COMMUNITY_WHATSAPP_URL } from "@/app/lib/communityLinks";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }), { virtual: true });
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/app/lib/cache/dashboardCache", () => ({ invalidateDashboardHomeSummaryCache: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { updateOne: jest.fn() },
}));

const updateOne = UserModel.updateOne as unknown as jest.Mock;

describe("GET /api/dashboard/community/free-join", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user_1" } });
    updateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("registra o opt-in e leva o visitante ao canal gratuito de avisos", async () => {
    const res = await GET();

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(COMMUNITY_FREE_WHATSAPP_URL);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "user_1" },
      expect.objectContaining({
        $set: expect.objectContaining({ communityInspirationOptIn: true }),
      }),
    );
  });

  it("nunca manda o visitante para o grupo de assinantes", async () => {
    const res = await GET();
    expect(res.headers.get("location")).not.toBe(COMMUNITY_WHATSAPP_URL);
  });

  it("manda para o login preservando o retorno quando não há sessão", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await GET();

    expect(res.headers.get("location")).toContain("/login?callbackUrl=");
    expect(res.headers.get("location")).toContain(encodeURIComponent("/api/dashboard/community/free-join"));
    expect(updateOne).not.toHaveBeenCalled();
  });
});
