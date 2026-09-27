/** @jest-environment node */

import { getMcpCreatorImages, isAllowedInstagramImageUrl } from "./creatorImages";
import { getInstagramConnectionDetails } from "@/app/lib/instagram/db/userActions";
import { fetchSingleInstagramMedia } from "@/app/lib/instagram/api/fetchers";
import MetricModel from "@/app/models/Metric";

const userId = "507f1f77bcf86cd799439021";
const metricId = "507f1f77bcf86cd799439031";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn(async () => undefined) }));
jest.mock("@/app/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock("sharp", () => { throw new Error("sharp indisponível no teste"); });
jest.mock("@/app/lib/instagram/db/userActions", () => ({ getInstagramConnectionDetails: jest.fn() }));
jest.mock("@/app/lib/instagram/api/fetchers", () => ({ fetchSingleInstagramMedia: jest.fn() }));

const leanQuery = (value: unknown) => {
  const query: any = { select: () => query, sort: () => query, limit: () => query, lean: async () => value };
  return query;
};
jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { findById: jest.fn(() => leanQuery({ _id: "u", profile_picture_url: "https://scontent.cdninstagram.com/perfil.jpg" })) },
}));
jest.mock("@/app/models/Metric", () => ({
  __esModule: true,
  default: {
    find: jest.fn(() => leanQuery([{
      _id: "507f1f77bcf86cd799439031",
      instagramMediaId: "178",
      coverUrl: "https://scontent.xx.fbcdn.net/vencida.jpg",
      thumbnailUrl: null,
      postDate: new Date("2026-09-01T12:00:00Z"),
      type: "REEL",
      postLink: "https://www.instagram.com/reel/abc/",
      description: "legenda",
    }])),
  },
}));

const mockConnection = getInstagramConnectionDetails as jest.MockedFunction<typeof getInstagramConnectionDetails>;
const mockFetchMedia = fetchSingleInstagramMedia as jest.MockedFunction<typeof fetchSingleInstagramMedia>;

function imageResponse(body = "jpeg") {
  return new Response(body, { status: 200, headers: { "content-type": "image/jpeg" } });
}

describe("getMcpCreatorImages", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.clearAllMocks(); });

  it("accepts only Instagram image hosts over https", () => {
    expect(isAllowedInstagramImageUrl("https://scontent.xx.fbcdn.net/a.jpg")).toBe(true);
    expect(isAllowedInstagramImageUrl("http://scontent.xx.fbcdn.net/a.jpg")).toBe(false);
    expect(isAllowedInstagramImageUrl("https://fbcdn.net.evil.com/a.jpg")).toBe(false);
    expect(isAllowedInstagramImageUrl("https://169.254.169.254/latest")).toBe(false);
  });

  it("refreshes an expired cover from Instagram when the account is connected", async () => {
    mockConnection.mockResolvedValue({ accessToken: "token", accountId: "17841" } as any);
    mockFetchMedia.mockResolvedValue({ success: true, data: [{ media_type: "VIDEO", thumbnail_url: "https://scontent.cdninstagram.com/nova.jpg" }] } as any);
    global.fetch = jest.fn(async (url: any) => String(url).includes("vencida")
      ? new Response("", { status: 403 })
      : imageResponse()) as any;

    const result = await getMcpCreatorImages({ userId, contentIds: [metricId] });

    expect(result?.items.map(item => [item.kind, item.delivered, item.source])).toEqual([
      ["profile_picture", true, "stored_url"],
      ["content_cover", true, "refreshed_from_instagram"],
    ]);
    expect(result?.images).toHaveLength(2);
    expect(result?.images[1]).toEqual({ index: 1, data: Buffer.from("jpeg").toString("base64"), mimeType: "image/jpeg" });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://scontent.cdninstagram.com/perfil.jpg",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("não troca um ID inválido pelas capas recentes", async () => {
    mockConnection.mockResolvedValue(null);
    const result = await getMcpCreatorImages({
      userId,
      contentIds: ["post:invalido"],
      includeProfilePicture: false,
    });

    expect(MetricModel.find).not.toHaveBeenCalled();
    expect(result?.items).toEqual([]);
    expect(result?.coverage.warnings).toContain("some_content_ids_not_found_for_creator");
  });

  it("não chama de ausente a capa que ficou fora do limite", async () => {
    mockConnection.mockResolvedValue(null);
    global.fetch = jest.fn(async () => imageResponse()) as any;
    const contentIds = Array.from({ length: 12 }, (_, index) => (index + 1).toString(16).padStart(24, "0"));
    (MetricModel.find as jest.Mock).mockImplementationOnce(() => leanQuery(contentIds.slice(0, 11).map((_id) => ({ _id }))));

    const result = await getMcpCreatorImages({ userId, contentIds });

    expect(result?.coverage.warnings).toContain("only_first_11_contents_returned");
    expect(result?.coverage.warnings).not.toContain("some_content_ids_not_found_for_creator");
    expect(result?.items).toHaveLength(12);
  });

  it("interrompe download sem tamanho declarado quando passa de 8 MB", async () => {
    mockConnection.mockResolvedValue(null);
    global.fetch = jest.fn(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1));
      },
    }), { headers: { "content-type": "image/jpeg" } })) as any;

    const result = await getMcpCreatorImages({ userId, recentLimit: 0 });

    expect(result?.items[0]).toMatchObject({ delivered: false, failure: "url_expired_and_account_disconnected" });
  });

  it("reports an expired cover honestly when the account is disconnected", async () => {
    mockConnection.mockResolvedValue(null);
    global.fetch = jest.fn(async (url: any) => String(url).includes("vencida")
      ? new Response("", { status: 403 })
      : imageResponse()) as any;

    const result = await getMcpCreatorImages({ userId, includeProfilePicture: false });

    expect(mockFetchMedia).not.toHaveBeenCalled();
    expect(result?.items[0]).toMatchObject({ delivered: false, failure: "url_expired_and_account_disconnected" });
    expect(result?.coverage.warnings).toContain("instagram_disconnected_expired_urls_cannot_be_refreshed");
  });
});
