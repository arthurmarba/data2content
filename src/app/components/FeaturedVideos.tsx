"use client";

import React, { useEffect, useState } from "react";
import VideoCard from "./VideoCard";

interface Video {
  videoId: string;
  title: string;
  description?: string;
}

const FeaturedVideos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch("/api/videos?q=marketing&maxResults=12", {
          credentials: "include", // Envia cookies de sessão
        });
        const data = await res.json();
        setVideos(data);
      } catch (error) {
        console.error("Erro ao buscar vídeos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  return (
    <section className="px-6 py-10">
      <h2 className="text-2xl font-light mb-4 text-gray-900">Vídeos em Destaque</h2>
      {loading ? (
        <div className="flex justify-center items-center">
          <p className="text-gray-700">Carregando vídeos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {videos.map((video) => (
            <VideoCard
              key={video.videoId}
              videoId={video.videoId}
              title={video.title}
              description={video.description}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default FeaturedVideos;
