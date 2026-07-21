/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET } from "./route";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import { resolveFreshInstagramAvatar } from "@/app/lib/instagram/resolveFreshAvatar";
import UserModel from "@/app/models/User";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({ resolveAuthOptions: jest.fn(async () => ({})) }));
jest.mock("@/app/lib/planGuard", () => ({ ensurePlannerAccess: jest.fn() }));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/lib/instagram/resolveFreshAvatar", () => ({
  resolveFreshInstagramAvatar: jest.fn(),
  isProfilePictureStale: jest.fn(() => false),
}));
jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const mockEnsurePlannerAccess = ensurePlannerAccess as jest.Mock;
const mockResolveFreshAvatar = resolveFreshInstagramAvatar as jest.Mock;
const mockFindById = UserModel.findById as jest.Mock;
const VIEWER_ID = "507f1f77bcf86cd799439011";
const CREATOR_ID = "507f191e810c19729de860ea";

function request() {
  return new NextRequest(
    `http://localhost/api/dashboard/mobile-strategic-profile/collabs/creators/${CREATOR_ID}/avatar`,
  );
}

function lookup(value: any) {
  const lean = jest.fn().mockResolvedValue(value);
  const select = jest.fn().mockReturnValue({ lean });
  mockFindById.mockReturnValue({ select });
}

describe("GET collab creator avatar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: VIEWER_ID } });
    mockEnsurePlannerAccess.mockResolvedValue({
      ok: true,
      normalizedStatus: "active",
      source: "database",
    });
  });

  it("exige autenticação", async () => {
    getServerSession.mockResolvedValue(null);
    const response = await GET(request(), { params: { creatorId: CREATOR_ID } });
    expect(response.status).toBe(401);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("bloqueia usuário sem plano ativo", async () => {
    mockEnsurePlannerAccess.mockResolvedValue({
      ok: true,
      normalizedStatus: null,
      source: "database",
    });
    const response = await GET(request(), { params: { creatorId: CREATOR_ID } });
    expect(response.status).toBe(403);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("rejeita creatorId inválido antes de consultar o banco", async () => {
    const response = await GET(request(), { params: { creatorId: "invalid" } });
    expect(response.status).toBe(400);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("redireciona para a rota consolidada quando existe mídia kit", async () => {
    lookup({ _id: CREATOR_ID, mediaKitSlug: "marina kit" });
    const response = await GET(request(), { params: { creatorId: CREATOR_ID } });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/api/mediakit/marina%20kit/avatar?v=20260719-collab-avatar-v4",
    );
    expect(mockResolveFreshAvatar).not.toHaveBeenCalled();
  });

  it("atualiza o Instagram e envia a foto fresca pelo proxy interno", async () => {
    lookup({
      _id: CREATOR_ID,
      mediaKitSlug: null,
      profile_picture_url: "https://scontent.fgru1-1.fna.fbcdn.net/old.jpg?oe=00000001",
      instagramAccountId: "ig-1",
      instagramAccessToken: "secret",
      isInstagramConnected: true,
    });
    const fresh = "https://scontent.fgru1-1.fna.fbcdn.net/fresh.jpg?oe=FFFFFFFF";
    mockResolveFreshAvatar.mockResolvedValue(fresh);

    const response = await GET(request(), { params: { creatorId: CREATOR_ID } });

    expect(mockResolveFreshAvatar).toHaveBeenCalledWith(expect.objectContaining({
      userId: CREATOR_ID,
      instagramAccountId: "ig-1",
      instagramAccessToken: "secret",
    }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `http://localhost/api/proxy/thumbnail/${encodeURIComponent(fresh)}?strict=1`,
    );
  });

  it("cai para a foto do provedor quando a atualização não produz foto válida", async () => {
    lookup({
      _id: CREATOR_ID,
      mediaKitSlug: null,
      profile_picture_url: null,
      providerImage: "https://lh3.googleusercontent.com/provider.jpg",
    });
    mockResolveFreshAvatar.mockResolvedValue(null);

    const response = await GET(request(), { params: { creatorId: CREATOR_ID } });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://lh3.googleusercontent.com/provider.jpg");
  });
});
