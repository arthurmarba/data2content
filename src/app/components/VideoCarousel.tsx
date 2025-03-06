"use client";

import React, { useEffect, useState } from "react";
import VideoCard from "./VideoCard";

interface Video {
  videoId: string;
  title: string;
  description?: string;
}

interface VideoCarouselProps {
  title: string;
  query: string;
  maxResults?: number;
}

const dummyVideos: Video[] = [
  { videoId: "dummy1", title: "Vídeo Dummy 1", description: "Descrição dummy 1" },
  { videoId: "dummy2", title: "Vídeo Dummy 2", description: "Descrição dummy 2" },
  { videoId: "dummy3", title: "Vídeo Dummy 3", description: "Descrição dummy 3" },
  { videoId: "dummy4", title: "Vídeo Dummy 4", description: "Descrição dummy 4" },
];

const VideoCarousel: React.FC<VideoCarouselProps> = ({ title, query, maxResults = 4 }) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch(`/api/videos?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setVideos(data);
        } else {
          setVideos(dummyVideos);
        }
      } catch (error) {
        console.error("Erro ao buscar vídeos:", error);
        setVideos(dummyVideos);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [query, maxResults]);

  return (
    <section className="mb-8">
      <h2 className="text-xl font-light mb-2 text-gray-900">{title}</h2>
      {loading ? (
        <div className="flex justify-center items-center">
          <p className="text-gray-700">Carregando vídeos...</p>
        </div>
      ) : (
        <div className="flex space-x-4 overflow-x-auto scrollbar-hide py-2">
          {videos.map((video) => (
            <div key={video.videoId} className="min-w-[300px]">
              <VideoCard
                videoId={video.videoId}
                title={video.title}
                description={video.description}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default VideoCarousel;
