"use client";

import React, { useCallback, useMemo, useState } from "react";
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
  badge?: number | null;
}

export default function CampaignsBoard({
  viewer,
  compactView = false,
  mobileAppView = false,
  headerActions,
  showTitleMarker = true,
  isHighlighted = false,
}: {
  viewer?: any;
  compactView?: boolean;
  mobileAppView?: boolean;
  headerActions?: React.ReactNode;
  showTitleMarker?: boolean;
  isHighlighted?: boolean;
}) {
  const dedicatedDesktopWidthClassName = "lg:max-w-[1640px]";
  const isBoardMobileViewport = useBoardMobileViewport();
  const useMobileAppView = mobileAppView && isBoardMobileViewport;
  const useCompactLayout = compactView || useMobileAppView;
  const [activeTab, setActiveTab] = useState<TabId>("crm");
  const [newProposalsCount, setNewProposalsCount] = useState(0);
  const handleNewProposalsCountChange = useCallback((count: number) => {
    setNewProposalsCount(count);
  }, []);
  const tabs = useMemo<Tab[]>(
    () => [
      {
        id: "crm",
        label: "Propostas recebidas",
        badge: newProposalsCount > 0 ? newProposalsCount : null,
      },
      { id: "publis", label: "Publis" },
      { id: "calculator", label: "Calculadora" },
    ],
    [newProposalsCount]
  );

  const renderContent = useMemo(() => {
    switch (activeTab) {
      case "crm":
        return (
          <ProposalsClient
            compactView={useCompactLayout}
            onNewCountChange={handleNewProposalsCountChange}
          />
        );
      case "publis":
        return <PublisClient compactView={useCompactLayout} />;
      case "calculator":
        return <CalculatorClient viewer={viewer} compactView={useCompactLayout} />;
      default:
        return null;
    }
  }, [activeTab, handleNewProposalsCountChange, useCompactLayout, viewer]);

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
      disableMobilePaddingTop={useMobileAppView}
      titleClassName="text-zinc-950"
      isHighlighted={isHighlighted}
    >
      <div
        className={`sticky top-0 z-30 backdrop-blur-md ${
          useMobileAppView
            ? "bg-[linear-gradient(180deg,rgba(243,244,246,0.98),rgba(243,244,246,0.94)_82%,rgba(243,244,246,0))] px-2 pt-0.5 pb-1.5"
            : "border-b border-zinc-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(255,255,255,0.96))] px-6 pt-3 pb-0"
        }`}
      >
        <div className={useMobileAppView ? "px-1 pb-2" : "pb-3"}>
          <p className="max-w-[34rem] text-[12px] leading-relaxed text-zinc-500 sm:text-[13px]">
            Acompanhe propostas, leia briefings e responda às marcas em um só lugar.
          </p>
        </div>
        <ThreadsTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          compact={useCompactLayout}
          variant="underline"
          className="w-full"
        />
      </div>
      <div className={useMobileAppView ? "px-2 pb-6 pt-2" : "px-5 pb-5 pt-1"}>{renderContent}</div>
    </Board>
  );
}
