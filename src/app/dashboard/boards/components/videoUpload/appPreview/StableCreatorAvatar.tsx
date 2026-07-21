"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { resolveStableCreatorAvatarUrl } from "@/app/lib/avatar/stableCreatorAvatarUrl";

export function StableCreatorAvatar({
  name,
  avatarUrl,
  creatorId,
  mediaKitSlug,
  fallbackText,
  fallbackClassName,
  imageClassName,
  imageStyle,
  alt = "",
}: {
  name?: string | null;
  avatarUrl?: string | null;
  creatorId?: string | null;
  mediaKitSlug?: string | null;
  fallbackText?: string;
  fallbackClassName?: string;
  imageClassName?: string;
  imageStyle?: CSSProperties;
  alt?: string;
}) {
  const resolvedUrl = resolveStableCreatorAvatarUrl({ avatarUrl, creatorId, mediaKitSlug });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fallback = (fallbackText ?? (name || "?").trim().slice(0, 1).toUpperCase()) || "?";

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [resolvedUrl]);

  return (
    <>
      <span
        aria-hidden="true"
        className={fallbackClassName}
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          opacity: loaded && !failed ? 0 : 1,
          transition: "opacity 160ms ease",
        }}
      >
        {fallback}
      </span>
      {resolvedUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          className={imageClassName}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 160ms ease",
            ...imageStyle,
          }}
        />
      ) : null}
    </>
  );
}
