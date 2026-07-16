import { resolveCreatorAvatar } from "./creatorAvatar";

describe("resolveCreatorAvatar", () => {
  it("prioriza a foto pública do Instagram para creators conectados", () => {
    expect(resolveCreatorAvatar({
      isInstagramConnected: true,
      profile_picture_url: " https://instagram.example/creator.jpg ",
      image: "https://google.example/login.jpg",
    })).toBe("https://instagram.example/creator.jpg");
  });

  it("usa a foto da conta do Instagram selecionada quando o campo principal está ausente", () => {
    expect(resolveCreatorAvatar({
      instagramAccountId: "ig-2",
      availableIgAccounts: [
        { igAccountId: "ig-1", profile_picture_url: "https://instagram.example/old.jpg" },
        { igAccountId: "ig-2", profile_picture_url: "https://instagram.example/current.jpg" },
      ],
    })).toBe("https://instagram.example/current.jpg");
  });

  it("mantém a foto do provedor como fallback para quem não conectou Instagram", () => {
    expect(resolveCreatorAvatar({
      providerImage: "https://google.example/creator.jpg",
      image: "https://google.example/session.jpg",
    })).toBe("https://google.example/creator.jpg");
  });
});
