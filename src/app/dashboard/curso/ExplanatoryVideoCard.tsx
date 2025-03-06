// src/app/dashboard/curso/ExplanatoryVideoCard.tsx
"use client";

import React from "react";
import YouTube, { YouTubeProps } from "react-youtube";

interface ExplanatoryVideoCardProps {
  videoId: string;
  title: string;
  description?: string;
}

const ExplanatoryVideoCard: React.FC<ExplanatoryVideoCardProps> = ({
  videoId,
  title,
  description,
}) => {
  const opts: YouTubeProps["opts"] = {
    height: "160",
    width: "100%",
    playerVars: { autoplay: 0 },
  };

  return (
    <div className="
      bg-white
      border border-gray-200
      rounded-md
      shadow-sm
      overflow-hidden
      transform
      transition
      duration-300
      hover:scale-[1.01]
    ">
      <div className="w-full">
        <YouTube videoId={videoId} opts={opts} className="w-full" />
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-800 mb-1" title={title}>
          {title}
        </h3>
        {description && (
          <p className="text-xs text-gray-600" title={description}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default ExplanatoryVideoCard;
