import {
  isMobileDashboardEntryRoute,
  isMobileStrategicProfileRoute,
  shouldRenderDashboardMobileBottomNav,
} from "./DashboardShell";
import { MOBILE_PROFILE_ROUTE } from "../boards/videoUpload/mobileStrategicProfileRoutes";

describe("DashboardShell mobile strategic profile routing", () => {
  it("identifica as rotas do Perfil Estratégico mobile", () => {
    expect(isMobileStrategicProfileRoute(MOBILE_PROFILE_ROUTE)).toBe(true);
    expect(isMobileStrategicProfileRoute(`${MOBILE_PROFILE_ROUTE}/extra`)).toBe(true);
    expect(isMobileStrategicProfileRoute("/dashboard/boards/mobile-strategic-profile-preview")).toBe(true);
    expect(isMobileStrategicProfileRoute("/planning/discover")).toBe(false);
  });

  it("identifica as entradas legadas que devem pular para o Perfil Estratégico no mobile", () => {
    expect(isMobileDashboardEntryRoute("/")).toBe(true);
    expect(isMobileDashboardEntryRoute("/dashboard")).toBe(true);
    expect(isMobileDashboardEntryRoute("/dashboard/home")).toBe(true);
    expect(isMobileDashboardEntryRoute(MOBILE_PROFILE_ROUTE)).toBe(false);
    expect(isMobileDashboardEntryRoute("/planning/discover")).toBe(false);
  });

  it("não renderiza a bottom nav global nas rotas do Perfil Estratégico mobile", () => {
    expect(
      shouldRenderDashboardMobileBottomNav({
        isPrintMode: false,
        isGuidedFlow: false,
        isMobile: true,
        isMobileStrategicProfileAppEnabled: true,
        pathname: MOBILE_PROFILE_ROUTE,
      }),
    ).toBe(false);

    expect(
      shouldRenderDashboardMobileBottomNav({
        isPrintMode: false,
        isGuidedFlow: false,
        isMobile: true,
        isMobileStrategicProfileAppEnabled: true,
        pathname: "/dashboard/boards/mobile-strategic-profile-preview",
      }),
    ).toBe(false);
  });

  it("mantém a bottom nav global para outras rotas mobile", () => {
    expect(
      shouldRenderDashboardMobileBottomNav({
        isPrintMode: false,
        isGuidedFlow: false,
        isMobile: true,
        isMobileStrategicProfileAppEnabled: true,
        pathname: "/planning/discover",
      }),
    ).toBe(true);
  });
});
