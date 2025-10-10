"use client";

import { useHeaderSetup } from "../context/HeaderContext";

export default function DiscoverHeaderConfigurator() {
  useHeaderSetup(
    {
      variant: "compact",
      showSidebarToggle: true,
      showUserMenu: true,
      sticky: true,
      contentTopPadding: 16,
      title: undefined,
      subtitle: undefined,
      condensedOnScroll: false,
    },
    []
  );

  return null;
}
