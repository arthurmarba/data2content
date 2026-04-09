"use client";

import React, { useMemo } from "react";
import { useSession } from "next-auth/react";

import Board from "@/app/dashboard/components/Board";
import { SelfMediaKitContent } from "@/app/dashboard/media-kit/page";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import MediaKitConversionSection from "@/app/dashboard/media-kit/components/MediaKitConversionSection";

export default function MediaKitPinnedBoard({
  showTitleMarker = true,
  isHighlighted = false,
}: {
  showTitleMarker?: boolean;
  isHighlighted?: boolean;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const billing = useBillingStatus();
  
  const userId = session?.user?.id ?? null;
  const instagramConnected = billing.instagram?.connected;
  const hasPro = billing.hasPremiumAccess;

  const showContent = useMemo(() => {
    return !!userId && !!instagramConnected && !!hasPro;
  }, [userId, instagramConnected, hasPro]);

  return (
    <Board
      title="Mídia Kit"
      showTitleMarker={showTitleMarker}
      titleMarkerVariant="chip"
      variant="card"
      showChevron={false}
      showOptions={false}
      contentClassName="bg-white"
      titleClassName="text-zinc-950"
      isHighlighted={isHighlighted}
    >
      {showContent ? (
        <SelfMediaKitContent
          userId={userId!}
          fallbackName={session?.user?.name}
          fallbackEmail={session?.user?.email}
          fallbackImage={session?.user?.image}
          compactPadding
          compactBoardPreview
          publicUrlForCopy={null}
        />
      ) : (
        <MediaKitConversionSection />
      )}
    </Board>
  );
}
