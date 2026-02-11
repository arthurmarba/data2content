import { buildSidebarSections } from "./config";

describe("sidebar planning scripts item", () => {
  it("inclui item Meus Roteiros na ordem esperada", () => {
    const sections = buildSidebarSections({
      hasPremiumAccess: true,
      planningLocked: false,
      dashboardMinimal: false,
    });
    const planningSection = sections.find((section) => section.key === "planning");
    expect(planningSection).toBeDefined();

    const itemKeys = planningSection?.items.map((item) => item.key) ?? [];
    expect(itemKeys).toContain("planning.scripts");

    const idxCalendar = itemKeys.indexOf("planning.calendar");
    const idxScripts = itemKeys.indexOf("planning.scripts");
    const idxDiscover = itemKeys.indexOf("planning.discover");

    expect(idxCalendar).toBeGreaterThanOrEqual(0);
    expect(idxScripts).toBeGreaterThan(idxCalendar);
    expect(idxDiscover).toBeGreaterThan(idxScripts);
  });

  it("marca item Meus Roteiros como bloqueado quando planningLocked=true", () => {
    const sections = buildSidebarSections({
      hasPremiumAccess: false,
      planningLocked: true,
      dashboardMinimal: false,
    });
    const planningSection = sections.find((section) => section.key === "planning");
    const scriptsItem = planningSection?.items.find((item) => item.type === "item" && item.key === "planning.scripts");

    expect(scriptsItem && scriptsItem.type === "item" ? scriptsItem.href : null).toBe("/planning/roteiros");
    expect(scriptsItem && scriptsItem.type === "item" ? scriptsItem.paywallContext : null).toBe("planning");
  });
});
