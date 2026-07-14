import type { LandingCreatorHighlight } from "@/types/landing";

import { FALLBACK_LANDING_CREATORS, selectLandingCreatorProofs } from "./narrativeData";

const creator = (
  overrides: Partial<LandingCreatorHighlight> = {},
): LandingCreatorHighlight => ({
  id: "creator-1",
  name: "Creator Um",
  username: "creatorum",
  avatarUrl: "https://images.example.com/creator.jpg",
  hasAvatarImage: true,
  totalInteractions: 0,
  postCount: 0,
  avgInteractionsPerPost: 0,
  avgReachPerPost: 0,
  rank: 1,
  ...overrides,
});

describe("selectLandingCreatorProofs", () => {
  it("mantém creators reais primeiro e completa a prova com retratos válidos", () => {
    const result = selectLandingCreatorProofs([creator()], 3);

    expect(result[0]?.username).toBe("creatorum");
    expect(result).toHaveLength(3);
    expect(result.every((item) => item.avatarUrl && item.hasAvatarImage !== false)).toBe(true);
  });

  it("remove duplicados e perfis sem foto", () => {
    const result = selectLandingCreatorProofs([
      creator(),
      creator({ id: "creator-duplicado", username: "@CreatorUm" }),
      creator({ id: "sem-foto", username: "semfoto", avatarUrl: "", hasAvatarImage: false }),
    ]);

    expect(result.filter((item) => item.username.replace(/^@/, "").toLowerCase() === "creatorum")).toHaveLength(1);
    expect(result.some((item) => item.id === "sem-foto")).toBe(false);
  });

  it("usa somente os retratos locais aprovados como fallback", () => {
    expect(FALLBACK_LANDING_CREATORS.map((item) => item.avatarUrl)).toEqual([
      "/images/Rafa Belli Foto D2C.png",
      "/images/Livia Foto D2C.png",
    ]);
  });
});
