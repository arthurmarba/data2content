"use client";

import Image from "next/image";
import { useState } from "react";

type CommunityCreatorProfileImageProps = {
  name: string;
  mediaKitSlug: string;
  src: string;
};

export function CommunityCreatorProfileImage({ name, mediaKitSlug, src }: CommunityCreatorProfileImageProps) {
  const endpointFallback = `/api/mediakit/${encodeURIComponent(mediaKitSlug)}/avatar?v=20260713-community-fallback-v1`;
  const [currentSrc, setCurrentSrc] = useState(src);

  return (
    <Image
      src={currentSrc}
      alt={`Foto de perfil de ${name}`}
      fill
      sizes="128px"
      unoptimized
      onError={() => {
        if (currentSrc !== endpointFallback) {
          setCurrentSrc(endpointFallback);
          return;
        }
        setCurrentSrc("/images/default-profile.png");
      }}
    />
  );
}
