"use client";

import { useHeaderSetup } from "../context/HeaderContext";

export default function DiscoverHeaderConfigurator() {
  useHeaderSetup(
    {
      variant: "compact",
      showSidebarToggle: true,
      showUserMenu: true,
      hideBrandLogoOnMobile: true,
      sticky: true,
      contentTopPadding: 0,
      title: undefined,
      subtitle: undefined,
      condensedOnScroll: false,
    },
    []
  );

  return null;
}
