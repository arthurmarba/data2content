"use client";

import type { PostCreationFunnelStage } from "./postCreationFunnel";
import PostCreationFunnelBoardShell from "./PostCreationFunnelBoardShell";

type ViewerInfo = {
  id?: string | null;
  role?: string | null;
  name?: string | null;
};

export default function PostCreationScriptsBoard({
  viewer,
  canInteract = false,
  viewerPending = false,
  initialInstagramConnected = false,
}: {
  viewer?: ViewerInfo;
  canInteract?: boolean;
  viewerPending?: boolean;
  initialInstagramConnected?: boolean;
}) {
  const initialFocusStage: PostCreationFunnelStage = "script";

  return (
    <PostCreationFunnelBoardShell
      viewer={viewer}
      canInteract={canInteract}
      viewerPending={viewerPending}
      initialInstagramConnected={initialInstagramConnected}
      initialFocusStage={initialFocusStage}
    />
  );
}
