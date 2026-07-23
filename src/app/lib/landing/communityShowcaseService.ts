import { connectToDatabase } from "@/app/lib/dataService/connection";
import UserModel from "@/app/models/User";
import type { LandingCreatorHighlight } from "@/types/landing";

const CACHE_TTL_MS = 15 * 60 * 1_000;

// Media Kits whose avatar endpoint currently resolves to the generic silhouette.
// Keep them out of the visual showcase until a real portrait is available.
const UNAVAILABLE_COMMUNITY_AVATAR_SLUGS = new Set([
  "aclara-oficial",
  "aline-aurea",
  "anna-clara-berner",
  "daniel-souza",
  "heslaine-vieira",
  "joao-carlos-gava-junior",
  "lary-kelbert",
  "le-mendonca",
  "lorena-franzoi",
  "luiza-zveiter",
  "mayra-bittar",
  "rafael-belli",
  "simone-magnus",
  "vivien-andrade-vivi",
  "yanna-livia",
  "ana-vieira",
  "erika-freitas",
  "maria-gomes",
  "thiany-belmoque",
]);

type PublicMediaKitCreator = {
  _id: { toString(): string };
  name?: string | null;
  mediaKitDisplayName?: string | null;
  username?: string | null;
  followers_count?: number | null;
  mediaKitSlug: string;
};

let cache: { expiresAt: number; creators: LandingCreatorHighlight[] } | null = null;

export function resetLandingCommunityShowcaseCacheForTests() {
  cache = null;
}

export function buildCommunityCreatorDirectory(users: PublicMediaKitCreator[]): LandingCreatorHighlight[] {
  return users
    .filter((user) => !UNAVAILABLE_COMMUNITY_AVATAR_SLUGS.has(user.mediaKitSlug.trim().toLocaleLowerCase("pt-BR")))
    .map((user, index) => {
      const slug = user.mediaKitSlug.trim();

      return {
        id: user._id.toString(),
        name: user.mediaKitDisplayName?.trim() || user.name?.trim() || user.username?.trim() || "Creator D2C",
        username: user.username?.trim() || null,
        followers: user.followers_count ?? null,
        avatarUrl: `/api/mediakit/${encodeURIComponent(slug)}/avatar?v=20260721-community-v2`,
        totalInteractions: 0,
        totalReach: 0,
        postCount: 0,
        avgInteractionsPerPost: 0,
        avgReachPerPost: 0,
        rank: index + 1,
        mediaKitSlug: slug,
        hasAvatarImage: true,
      };
    });
}

export async function fetchLandingCommunityShowcase(): Promise<LandingCreatorHighlight[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.creators.map((creator) => ({ ...creator }));

  await connectToDatabase();
  const users = await UserModel.find(
    {
      planStatus: "active",
      mediaKitSlug: { $exists: true, $nin: [null, ""] },
      $or: [
        { providerImage: { $exists: true, $nin: [null, ""] } },
        { image: { $exists: true, $nin: [null, ""] } },
        { profile_picture_url: { $exists: true, $nin: [null, ""] } },
        { "instagram.profile_picture_url": { $exists: true, $nin: [null, ""] } },
        { "instagram.profilePictureUrl": { $exists: true, $nin: [null, ""] } },
        { availableIgAccounts: { $elemMatch: { profile_picture_url: { $exists: true, $nin: [null, ""] } } } },
      ],
    },
    {
      _id: 1,
      name: 1,
      mediaKitDisplayName: 1,
      username: 1,
      followers_count: 1,
      mediaKitSlug: 1,
    },
  )
    .sort({ mediaKitDisplayName: 1, name: 1, username: 1, _id: 1 })
    .lean<PublicMediaKitCreator[]>()
    .exec();

  const creators = buildCommunityCreatorDirectory(users);
  cache = { expiresAt: now + CACHE_TTL_MS, creators };
  return creators.map((creator) => ({ ...creator }));
}
