"use client";

import React from "react";
import YouTube, { YouTubeProps } from "react-youtube";

interface VideoCardProps {
  videoId: string;
  title: string;
  description?: string;
}

const VideoCard: React.FC<VideoCardProps> = ({ videoId, title, description }) => {
  const opts: YouTubeProps["opts"] = {
    height: "200",
    width: "100%",
    playerVars: { autoplay: 0 },
  };

  return (
    <div className="w-full h-80 bg-white rounded-lg shadow-md transform transition duration-300 hover:scale-105 hover:shadow-lg p-4">
      <div className="mb-2">
        <YouTube videoId={videoId} opts={opts} className="rounded-md" />
      </div>
      {/* Container para os textos com flex para empurrá-los para o final */}
      <div className="flex flex-col flex-grow justify-end">
        <h3 className="text-xl font-bold text-gray-900 truncate" title={title}>
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-gray-700 line-clamp-2" title={description}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default VideoCard;
