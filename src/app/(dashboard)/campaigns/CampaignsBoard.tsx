"use client";

import React, { useMemo, useState } from "react";
import Board from "@/app/dashboard/components/Board";
import ThreadsTabs from "@/app/dashboard/components/ThreadsTabs";
import ProposalsClient from "@/app/dashboard/proposals/ProposalsClient";
import PublisClient from "@/app/dashboard/publis/PublisClient";
import CalculatorClient from "@/app/dashboard/calculator/CalculatorClient";
import useBoardMobileViewport from "@/app/dashboard/hooks/useBoardMobileViewport";

type TabId = "crm" | "publis" | "calculator";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "crm", label: "Gestão (CRM)" },
  { id: "publis", label: "Publis" },
  { id: "calculator", label: "Calculadora" },
];

export default function CampaignsBoard({
  viewer,
  compactView = false,
  mobileAppView = false,
  headerActions,
  showTitleMarker = true,
}: {
  viewer?: any;
  compactView?: boolean;
  mobileAppView?: boolean;
  headerActions?: React.ReactNode;
  showTitleMarker?: boolean;
}) {
  const dedicatedDesktopWidthClassName = "lg:max-w-[1640px]";
  const isBoardMobileViewport = useBoardMobileViewport();
  const useMobileAppView = mobileAppView && isBoardMobileViewport;
  const useCompactLayout = compactView || useMobileAppView;
  const [activeTab, setActiveTab] = useState<TabId>("crm");

  const renderContent = useMemo(() => {
    switch (activeTab) {
      case "crm":
        return <ProposalsClient compactView={useCompactLayout} />;
      case "publis":
        return <PublisClient compactView={useCompactLayout} />;
      case "calculator":
        return <CalculatorClient viewer={viewer} compactView={useCompactLayout} />;
      default:
        return null;
    }
  }, [activeTab, useCompactLayout, viewer]);

  return (
    <Board
      title="Campanhas"
      titleInlineAction={headerActions}
      promoteHeaderOnMobile
      mobilePresentation={useMobileAppView ? "flat" : "surface"}
      showTitleMarker={showTitleMarker}
      titleMarkerVariant="chip"
      variant="card"
      showChevron={false}
      showOptions={false}
      hideActionsUntilHover={false}
      className="before:hidden"
      desktopWidthClassName={!useCompactLayout ? dedicatedDesktopWidthClassName : ""}
      contentClassName={useMobileAppView ? "bg-transparent" : "bg-white"}
      titleClassName="text-zinc-950"
    >
      <div
        className={`sticky top-0 z-30 backdrop-blur-md ${
          useMobileAppView
            ? "bg-[linear-gradient(180deg,rgba(243,244,246,0.96),rgba(243,244,246,0.92)_74%,rgba(243,244,246,0))] px-2 pt-0.5 pb-1.5"
            : "border-b border-zinc-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] px-6 pt-2.5 pb-2.5"
        }`}
      >
        <ThreadsTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          compact={useCompactLayout}
          segmentedTheme={useCompactLayout ? "mono" : "default"}
          className={useMobileAppView
            ? "w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,247,248,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(24,24,27,0.035)] ring-1 ring-white/75"
            : "w-full"}
        />
      </div>
      <div className={useMobileAppView ? "px-2 pb-6 pt-2" : "px-5 pb-5 pt-1"}>{renderContent}</div>
    </Board>
  );
}
