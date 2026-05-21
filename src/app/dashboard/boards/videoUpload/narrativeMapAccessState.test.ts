import {
  getNarrativeMapAccessAction,
  resolveNarrativeMapAccessState,
  sanitizeInternalReturnTo,
} from "./narrativeMapAccessState";

describe("narrativeMapAccessState", () => {
  it("Free sem leitura usada retorna free_unused", () => {
    expect(resolveNarrativeMapAccessState({ readingQuota: { usedTotal: 0 } })).toBe("free_unused");
    expect(getNarrativeMapAccessAction("free_unused").canStartReading).toBe(true);
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
});
