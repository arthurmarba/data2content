"use client";

import Image from "next/image";

import type { RecordedMeetingCatalogItem } from "@/app/lib/community/recordedMeetingsService";

type RecordedMeetingThumbnailProps = {
  meeting: RecordedMeetingCatalogItem;
  sizes: string;
  className?: string;
  priority?: boolean;
};

export default function RecordedMeetingThumbnail({
  meeting,
  sizes,
  className = "",
  priority = false,
}: RecordedMeetingThumbnailProps) {
  return (
    <Image
      src={meeting.thumbnailUrl}
      alt={`Capa da reunião ${meeting.title}`}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${className}`}
    />
  );
}
