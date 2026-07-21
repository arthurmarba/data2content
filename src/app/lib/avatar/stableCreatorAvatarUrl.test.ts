import { resolveStableCreatorAvatarUrl } from "./stableCreatorAvatarUrl";

describe("resolveStableCreatorAvatarUrl", () => {
  it("prioriza a rota interna estável quando existe mídia kit", () => {
    expect(resolveStableCreatorAvatarUrl({
      avatarUrl: "https://example.com/old.jpg",
      mediaKitSlug: "marina braga",
    })).toBe("/api/mediakit/marina%20braga/avatar?v=20260719-collab-avatar-v4");
  });

  it("usa proxy estrito para uma URL assinada do Instagram", () => {
    const avatarUrl = "https://scontent.fgru1-1.fna.fbcdn.net/avatar.jpg?oe=ABC";
    expect(resolveStableCreatorAvatarUrl({ avatarUrl })).toBe(
      `/api/proxy/thumbnail/${encodeURIComponent(avatarUrl)}?strict=1`,
    );
  });

  it("usa a rota autenticada do creator quando não existe mídia kit", () => {
    expect(resolveStableCreatorAvatarUrl({
      creatorId: "507f191e810c19729de860ea",
      avatarUrl: "https://example.com/old.jpg",
    })).toBe(
      "/api/dashboard/mobile-strategic-profile/collabs/creators/507f191e810c19729de860ea/avatar?v=20260719-collab-avatar-v4",
    );
  });

  it("mantém URLs de provedores não bloqueados e retorna null sem fonte", () => {
    expect(resolveStableCreatorAvatarUrl({ avatarUrl: "https://lh3.googleusercontent.com/avatar.jpg" }))
      .toBe("https://lh3.googleusercontent.com/avatar.jpg");
    expect(resolveStableCreatorAvatarUrl({ avatarUrl: null, mediaKitSlug: null })).toBeNull();
  });
});
