import { buildSidebarSections } from "./config";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";

describe("sidebar planning hub item", () => {
  it("aponta a casinha para a Home autenticada", () => {
    const sections = buildSidebarSections({
      hasPremiumAccess: true,
      planningLocked: false,
      dashboardMinimal: false,
      isMobile: false,
    });
    const home = sections.flatMap((section) => section.items).find((item) => item.key === "dashboard");

    expect(home).toEqual(expect.objectContaining({ href: MAIN_DASHBOARD_ROUTE }));
  });

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
