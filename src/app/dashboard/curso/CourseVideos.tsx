// src/app/dashboard/curso/CourseVideos.tsx
"use client";

import React from "react";
import ExplanatoryVideoCard from "./ExplanatoryVideoCard";

const videos = [
  { videoId: "dQw4w9WgXcQ", title: "Introdução à Estratégia", description: "..." },
  { videoId: "9bZkp7q19f0", title: "Como Engajar", description: "..." },
  // ...
];

export default function CourseVideos() {
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex space-x-4">
        {videos.map((video, idx) => (
          <div key={idx} className="min-w-[220px] w-60 flex-shrink-0">
            <ExplanatoryVideoCard
              videoId={video.videoId}
              title={video.title}
              description={video.description}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
