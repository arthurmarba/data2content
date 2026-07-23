"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type CommunityCreatorProfileImageProps = {
  name: string;
  mediaKitSlug: string;
  src: string;
  eager?: boolean;
};

export function CommunityCreatorProfileImage({ name, mediaKitSlug, src, eager = false }: CommunityCreatorProfileImageProps) {
  const endpointFallback = `/api/mediakit/${encodeURIComponent(mediaKitSlug)}/avatar?v=20260713-community-fallback-v1`;
  const productionEndpointFallback = `https://data2content.ai/api/mediakit/${encodeURIComponent(mediaKitSlug)}/avatar?v=20260722-community-fallback-v2`;
  const [currentSrc, setCurrentSrc] = useState(src);
  const imageRef = useRef<HTMLImageElement>(null);

  const advanceFallback = useCallback(() => {
    if (currentSrc !== endpointFallback && currentSrc !== productionEndpointFallback) {
      setCurrentSrc(endpointFallback);
      return;
    }
    if (currentSrc === endpointFallback) {
      setCurrentSrc(productionEndpointFallback);
      return;
    }
    setCurrentSrc("/images/default-profile.png");
  }, [currentSrc, endpointFallback, productionEndpointFallback]);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) advanceFallback();
  }, [advanceFallback]);

  return (
    <Image
      ref={imageRef}
      src={currentSrc}
      alt={`Foto de perfil de ${name}`}
      fill
      sizes="128px"
      loading={eager ? "eager" : "lazy"}
      unoptimized={currentSrc.startsWith("/api/mediakit/")}
      onError={advanceFallback}
    />
  );
}
