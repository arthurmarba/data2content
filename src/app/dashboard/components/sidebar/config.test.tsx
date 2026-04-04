import { buildSidebarSections } from "./config";

describe("sidebar planning hub item", () => {
  it("inclui o hub de Criação de Post na ordem esperada", () => {
    const sections = buildSidebarSections({
      hasPremiumAccess: true,
      planningLocked: false,
      dashboardMinimal: false,
      isMobile: false,
    });
    const planningSection = sections.find((section) => section.key === "planning");
    expect(planningSection).toBeDefined();

    const itemKeys = planningSection?.items.map((item) => item.key) ?? [];
    expect(itemKeys).toContain("calendar.hub");

    const idxHub = itemKeys.indexOf("calendar.hub");
    const idxDiscover = itemKeys.indexOf("planning.discover");

    expect(idxHub).toBeGreaterThanOrEqual(0);
    expect(idxDiscover).toBeGreaterThan(idxHub);
  });

  it("mantém o hub principal acessível quando planningLocked=true", () => {
    const sections = buildSidebarSections({
      hasPremiumAccess: false,
      planningLocked: true,
      dashboardMinimal: false,
      isMobile: false,
    });
    const planningSection = sections.find((section) => section.key === "planning");
    const hubItem = planningSection?.items.find((item) => item.type === "item" && item.key === "calendar.hub");

    expect(hubItem && hubItem.type === "item" ? hubItem.href : null).toBe("/calendar");
    expect(hubItem && hubItem.type === "item" ? hubItem.paywallContext : undefined).toBeUndefined();
  });
});
