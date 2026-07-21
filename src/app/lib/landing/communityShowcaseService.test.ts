import { connectToDatabase } from "@/app/lib/dataService/connection";
import UserModel from "@/app/models/User";

import {
  buildCommunityCreatorDirectory,
  fetchLandingCommunityShowcase,
  resetLandingCommunityShowcaseCacheForTests,
} from "./communityShowcaseService";

jest.mock("@/app/lib/dataService/connection", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({ __esModule: true, default: { find: jest.fn() } }));

const mockConnect = connectToDatabase as jest.Mock;
const mockFind = UserModel.find as jest.Mock;

describe("communityShowcaseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLandingCommunityShowcaseCacheForTests();
    mockConnect.mockResolvedValue(undefined);
  });

  it("queries only active users with a public Media Kit slug", async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const lean = jest.fn(() => ({ exec }));
    const sort = jest.fn(() => ({ lean }));
    mockFind.mockReturnValue({ sort });

    await fetchLandingCommunityShowcase();

    expect(mockFind).toHaveBeenCalledWith(
      {
        planStatus: "active",
        mediaKitSlug: { $exists: true, $nin: [null, ""] },
      },
      expect.objectContaining({ _id: 1, mediaKitSlug: 1, mediaKitDisplayName: 1 }),
    );
  });

  it("keeps every public creator and uses the Media Kit avatar endpoint", () => {
    const creators = buildCommunityCreatorDirectory([
      {
        _id: { toString: () => "creator-1" },
        name: "Nome da conta",
        mediaKitDisplayName: "Nome público",
        username: "creator",
        followers_count: 1200,
        mediaKitSlug: "creator-publico",
      },
      {
        _id: { toString: () => "creator-2" },
        name: "Outro creator",
        mediaKitSlug: "outro-creator",
      },
    ]);

    expect(creators).toHaveLength(2);
    expect(creators[0]).toEqual(expect.objectContaining({
      name: "Nome público",
      mediaKitSlug: "creator-publico",
      avatarUrl: "/api/mediakit/creator-publico/avatar?v=20260721-community-v2",
      hasAvatarImage: true,
    }));
    expect(creators[1]).toEqual(expect.objectContaining({ name: "Outro creator", rank: 2 }));
  });
});
