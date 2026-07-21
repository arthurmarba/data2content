import { isUsableCreatorAvatarUrl, resolveCreatorAvatar } from "./creatorAvatar";

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

  it("ignora uma URL expirada do Instagram e usa a foto do provedor", () => {
    expect(resolveCreatorAvatar({
      isInstagramConnected: true,
      profile_picture_url: "https://scontent.fgru1-1.fna.fbcdn.net/avatar.jpg?oe=00000001",
      providerImage: "https://lh3.googleusercontent.com/provider.jpg",
    })).toBe("https://lh3.googleusercontent.com/provider.jpg");
  });

  it("preserva uma URL assinada do Instagram que ainda está válida", () => {
    const fresh = "https://scontent.fgru1-1.fna.fbcdn.net/avatar.jpg?oe=FFFFFFFF";
    expect(isUsableCreatorAvatarUrl(fresh)).toBe(true);
    expect(resolveCreatorAvatar({
      isInstagramConnected: true,
      profile_picture_url: fresh,
      providerImage: "https://lh3.googleusercontent.com/provider.jpg",
    })).toBe(fresh);
  });

  it("tenta outra conta conectada quando a foto selecionada expirou", () => {
    const fresh = "https://scontent.fgru1-1.fna.fbcdn.net/current.jpg?oe=FFFFFFFF";
    expect(resolveCreatorAvatar({
      instagramAccountId: "ig-old",
      availableIgAccounts: [
        {
          igAccountId: "ig-old",
          profile_picture_url: "https://scontent.fgru1-1.fna.fbcdn.net/old.jpg?oe=00000001",
        },
        { igAccountId: "ig-current", profile_picture_url: fresh },
      ],
    })).toBe(fresh);
  });
});
