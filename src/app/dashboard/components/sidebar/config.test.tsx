import {
  buildSidebarSections,
  filterDesktopSidebarSections,
} from "./config";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";

describe("sidebar product navigation", () => {
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

  it("expõe o Perfil canônico antes das ferramentas do desktop", () => {
    const sections = filterDesktopSidebarSections(buildSidebarSections({
      hasPremiumAccess: false,
      planningLocked: false,
      dashboardMinimal: false,
      isMobile: false,
    }));
    const items = sections.flatMap((section) => section.items);

    expect(items[0]).toEqual(expect.objectContaining({
      key: "profile",
      label: "Perfil",
      href: "/dashboard/profile",
    }));
  });

  it.each([false, true])(
    "mantém as ferramentas disponíveis e oculta as rotas antigas de planejamento (isMobile=%s)",
    (isMobile) => {
      const sections = buildSidebarSections({
        hasPremiumAccess: true,
        planningLocked: false,
        dashboardMinimal: false,
        isMobile,
      });
      const itemKeys = sections.flatMap((section) => section.items.map((item) => item.key));

      expect(itemKeys).not.toContain("calendar.hub");
      expect(itemKeys).not.toContain("planning.charts");
      expect(itemKeys).not.toContain("planning.discover");
      expect(sections.find((section) => section.key === "planning")).toEqual(
        expect.objectContaining({
          title: "Ferramentas",
          items: expect.arrayContaining([
            expect.objectContaining({ key: "collabs" }),
            expect.objectContaining({ key: "media-kit" }),
          ]),
        }),
      );
    },
  );

  it("mantém apenas os seis destinos principais além do Início", () => {
    const sections = buildSidebarSections({
      hasPremiumAccess: true,
      planningLocked: false,
      dashboardMinimal: false,
      isMobile: false,
    });
    const desktopSections = filterDesktopSidebarSections(sections);
    const itemKeys = desktopSections.flatMap((section) => section.items.map((item) => item.key));

    expect(itemKeys).toEqual([
      "profile",
      "dashboard",
      "recorded-meetings",
      "strategic-map",
      "collabs",
      "media-kit",
      "campaigns.overview",
      "affiliates",
    ]);
  });

  it("mantém Campanhas como destino comercial canônico no desktop", () => {
    const sections = buildSidebarSections({
      hasPremiumAccess: false,
      planningLocked: false,
      dashboardMinimal: false,
      isMobile: false,
    });
    const desktopSections = filterDesktopSidebarSections(sections);
    const monetizationSection = desktopSections.find(
      (section) => section.key === "monetization"
    );
    const campaignsItem = monetizationSection?.items.find(
      (item) => item.type === "item" && item.key === "campaigns.overview"
    );

    expect(campaignsItem && campaignsItem.type === "item" ? campaignsItem.href : null).toBe(
      "/campaigns"
    );
  });

  it("abre o catálogo de Reuniões gravadas para free e Pro", () => {
    const freeSections = buildSidebarSections({
      hasPremiumAccess: false,
      planningLocked: false,
      dashboardMinimal: false,
      isMobile: false,
    });
    const proSections = buildSidebarSections({
      hasPremiumAccess: true,
      planningLocked: false,
      dashboardMinimal: false,
      isMobile: false,
    });
    const findRecordedMeetings = (sections: ReturnType<typeof buildSidebarSections>) =>
      sections
        .flatMap((section) => section.items)
        .find((item) => item.key === "recorded-meetings");

    expect(findRecordedMeetings(freeSections)).toEqual(
      expect.objectContaining({
        href: "/reunioes-gravadas",
        label: "Reuniões gravadas",
        paywallContext: undefined,
      }),
    );
    expect(findRecordedMeetings(proSections)).toEqual(
      expect.objectContaining({
        href: "/reunioes-gravadas",
        paywallContext: undefined,
      }),
    );
  });
});
