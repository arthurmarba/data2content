"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useSidebarViewport } from "../components/sidebar/hooks";
import { useHeaderSetup } from "../context/HeaderContext";

const SurveyModal = dynamic(() => import("./minimal/SurveyModal"), {
  ssr: false,
  loading: () => null,
});

const DiscoverBoard = dynamic(() => import("../discover/DiscoverBoard"), {
  ssr: false,
  loading: () => null,
});

const HomeDesktopBoards = dynamic(() => import("./HomeDesktopBoards"), {
  ssr: false,
  loading: () => null,
});

function SingleBoardHomeFrame({
  children,
  boardWidthClassName,
  itemClassName,
}: {
  children: React.ReactNode;
  boardWidthClassName: string;
  itemClassName?: string;
}) {
  return (
    <div className="relative h-full min-h-0 w-full">
      <div className="h-full overflow-x-hidden overflow-y-hidden px-4 pb-4 pt-4 sm:px-6 lg:px-8 lg:pb-5 lg:pt-11">
        <div className="flex h-full items-start justify-center">
          <div className={`${boardWidthClassName} h-full ${itemClassName ?? ""}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}


export default function HomeClientPage() {
  const searchParams = useSearchParams();
  const surveyIntent = searchParams?.get("intent")?.toLowerCase() === "survey";
  const { mounted: viewportMounted, isMobile } = useSidebarViewport();
  const [showSurveyModal, setShowSurveyModal] = React.useState(surveyIntent);

  React.useEffect(() => {
    if (surveyIntent) setShowSurveyModal(true);
  }, [surveyIntent]);

  useHeaderSetup(
    {
      cta: null,
      extraContent: null,
      hideBrandLogoOnMobile: true,
      sticky: true,
      contentTopPadding: 0,
    },
    [],
  );

  const boardWidthClassName = "w-[min(415px,calc(100vw-28px))] lg:w-[450px] xl:w-[470px]";
  const shouldUseSingleDiscoverBoard = !viewportMounted || isMobile;

  return (
    <>
      {shouldUseSingleDiscoverBoard ? (
        <SingleBoardHomeFrame
          boardWidthClassName={boardWidthClassName}
          itemClassName="lg:-mt-[2.75rem] lg:h-[calc(100%+2.75rem)]"
        >
          <DiscoverBoard mobileAppView showTitleMarker={false} />
        </SingleBoardHomeFrame>
      ) : (
        <HomeDesktopBoards />
      )}

      {showSurveyModal ? (
        <SurveyModal
          open={showSurveyModal}
          onClose={() => setShowSurveyModal(false)}
          onSaved={() => setShowSurveyModal(false)}
        />
      ) : null}
    </>
  );
}
