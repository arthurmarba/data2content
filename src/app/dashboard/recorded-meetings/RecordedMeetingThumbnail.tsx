"use client";

import Image from "next/image";
import React from "react";

import type { RecordedMeeting } from "@/app/lib/community/recordedMeetingsService";

type RecordedMeetingThumbnailProps = {
  meeting: RecordedMeeting;
  sizes: string;
  className?: string;
  priority?: boolean;
};

function getHighResolutionThumbnail(meeting: RecordedMeeting) {
  return `https://img.youtube.com/vi/${meeting.youtubeVideoId}/maxresdefault.jpg`;
}

export default function RecordedMeetingThumbnail({
  meeting,
  sizes,
  className = "",
  priority = false,
}: RecordedMeetingThumbnailProps) {
  const highResolutionThumbnail = getHighResolutionThumbnail(meeting);
  const [source, setSource] = React.useState(highResolutionThumbnail);

  React.useEffect(() => {
    setSource(highResolutionThumbnail);
  }, [highResolutionThumbnail]);

  return (
    <Image
      src={source}
      alt={`Capa da reunião ${meeting.title}`}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${className}`}
      onError={() => {
        if (source !== meeting.thumbnailUrl) setSource(meeting.thumbnailUrl);
      }}
    />
  );
}
