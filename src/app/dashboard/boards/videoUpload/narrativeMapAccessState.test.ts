import {
  getNarrativeMapAccessAction,
  getNarrativeMapStatusCardContent,
  resolveNarrativeMapAccessState,
  sanitizeInternalReturnTo,
} from "./narrativeMapAccessState";

describe("narrativeMapAccessState", () => {
  it("Free sem leitura usada retorna free_unused", () => {
    expect(resolveNarrativeMapAccessState({ readingQuota: { usedTotal: 0 } })).toBe("free_unused");
    expect(getNarrativeMapAccessAction("free_unused").canStartReading).toBe(true);
    expect(getNarrativeMapAccessAction("free_unused").label).toBe("Analisar meu primeiro vídeo");
  });

  it("Free com leitura usada retorna free_preview_used", () => {
    expect(resolveNarrativeMapAccessState({ readingQuota: { usedTotal: 1 } })).toBe("free_preview_used");
    expect(getNarrativeMapAccessAction("free_preview_used").canStartReading).toBe(false);
  });

  it("Pro sem Instagram retorna pro_needs_instagram", () => {
    expect(resolveNarrativeMapAccessState({
      hasPremiumAccess: true,
      instagram: { connected: false },
      readingQuota: { usedThisMonth: 2 },
    })).toBe("pro_needs_instagram");
  });

  it("Pro com Instagram retorna pro_instagram_connected", () => {
    expect(resolveNarrativeMapAccessState({
      hasPremiumAccess: true,
      instagram: { connected: true },
      readingQuota: { usedThisMonth: 2 },
    })).toBe("pro_instagram_connected");
  });

  it("Pro com 10/10 leituras retorna pro_quota_reached", () => {
    expect(resolveNarrativeMapAccessState({
      hasPremiumAccess: true,
      instagram: { connected: true },
      readingQuota: { usedThisMonth: 10 },
    })).toBe("pro_quota_reached");
  });

  it("Pagamento pendente e ação necessária têm estados próprios", () => {
    expect(resolveNarrativeMapAccessState({ needsCheckout: true, readingQuota: { usedTotal: 0 } })).toBe("payment_pending");
    expect(resolveNarrativeMapAccessState({ needsPaymentAction: true, readingQuota: { usedTotal: 0 } })).toBe("payment_action_needed");
  });

  it("Admin recebe acesso sem loading indevido", () => {
    expect(resolveNarrativeMapAccessState({
      isAdmin: true,
      needsCheckout: true,
      readingQuota: { usedTotal: 99, usedThisMonth: 99 },
    })).toBe("admin");
  });

  it("sanitiza returnTo interno e rejeita externo", () => {
    expect(sanitizeInternalReturnTo("/dashboard/boards/mobile-strategic-profile")).toBe("/dashboard/boards/mobile-strategic-profile");
    expect(sanitizeInternalReturnTo("//evil.example/path", "/fallback")).toBe("/fallback");
    expect(sanitizeInternalReturnTo("https://evil.example/path", "/fallback")).toBe("/fallback");
  });

  it("resolve copy compacta do Status Card por estado MM90", () => {
    expect(getNarrativeMapStatusCardContent({ state: "free_unused" })).toMatchObject({
      title: "Perfil em construção",
      primaryLabel: "Analisar meu primeiro vídeo",
    });
    expect(getNarrativeMapStatusCardContent({ state: "free_preview_used" })).toMatchObject({
      title: "Leitura grátis usada",
      primaryLabel: "Assinar Pro",
    });
    expect(getNarrativeMapStatusCardContent({ state: "pro_needs_instagram" })).toMatchObject({
      title: "Pro ativo",
      primaryLabel: "Conectar Instagram",
      secondaryLabel: "Nova leitura",
    });
    expect(getNarrativeMapStatusCardContent({
      state: "pro_instagram_connected",
      quota: { usedThisMonth: 3 },
    })).toMatchObject({
      title: "Pro ativo",
      description: "3/10 leituras",
      primaryLabel: "Nova leitura",
    });
    expect(getNarrativeMapStatusCardContent({
      state: "pro_instagram_connected",
      quota: { usedThisMonth: 9 },
    })).toMatchObject({
      title: "Pro ativo",
      description: "Restam 1 leituras este mês.",
      primaryLabel: "Nova leitura",
    });
    expect(getNarrativeMapStatusCardContent({ state: "pro_quota_reached" })).toMatchObject({
      title: "10/10 usadas",
      description: "Novas leituras liberam no próximo ciclo. Seu Perfil continua disponível.",
      primaryLabel: "Ver leituras",
    });
    expect(getNarrativeMapStatusCardContent({ state: "payment_pending" }).primaryLabel).toBe("Continuar pagamento");
    expect(getNarrativeMapStatusCardContent({ state: "payment_action_needed" }).primaryLabel).toBe("Atualizar pagamento");
  });
});
