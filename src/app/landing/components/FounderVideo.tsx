'use client';

import React, { useEffect, useRef } from 'react';
import { FaPlay } from 'react-icons/fa';

interface FounderVideoProps {
  videoId: string;
}

export default function FounderVideo({ videoId }: FounderVideoProps) {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = videoRef.current;
    if (!container) return;

    const observer = new IntersectionObserver((entries, obs) => {
      const entry = entries[0];
      // CORREÇÃO: Adicionada uma verificação para garantir que 'entry' não é undefined.
      if (entry && entry.isIntersecting) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
        iframe.title = 'YouTube video player';
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.className = 'absolute top-0 left-0 h-full w-full';
        container.innerHTML = '';
        container.appendChild(iframe);
        obs.disconnect();
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [videoId]);

  return (
    <div
      ref={videoRef}
      className="relative mt-10 overflow-hidden rounded-2xl shadow-lg w-full aspect-video"
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
        alt="Thumbnail do vídeo"
        className="absolute top-0 left-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-black/60 rounded-full p-4">
          <FaPlay className="text-white text-3xl" />
        </div>
      </div>
    </div>
  );
}
