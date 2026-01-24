"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function buildInstagramEmbed(postLink: string): string | null {
  try {
    const u = new URL(postLink);
    if (!/instagram\.com$/i.test(u.hostname) && !/\.instagram\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const type = parts[0];
    const code = parts[1];
    if (!code) return null;
    if (type === 'reel' || type === 'p' || type === 'tv') {
      return `https://www.instagram.com/${type}/${code}/embed`;
    }
    return `https://www.instagram.com/p/${code}/embed`;
  } catch {
    return null;
  }
}

export default function DiscoverVideoModal({
  open,
  onClose,
  postLink,
  videoUrl,
  posterUrl,
  nextItem,
}: {
  open: boolean;
  onClose: () => void;
  postLink?: string;
  videoUrl?: string;
  posterUrl?: string;
  nextItem?: {
    id: string;
    videoUrl?: string;
    postLink?: string;
    posterUrl?: string;
    caption?: string;
    creatorName?: string;
  };
}) {
  const [mounted, setMounted] = useState(false);
  const queue = useMemo(() => {
    if (!open) return [];
    const current = {
      id: "current",
      videoUrl,
      postLink,
      posterUrl,
    };
    const next = nextItem
      ? {
          id: nextItem.id,
          videoUrl: nextItem.videoUrl,
          postLink: nextItem.postLink,
          posterUrl: nextItem.posterUrl,
          caption: nextItem.caption,
          creatorName: nextItem.creatorName,
        }
      : null;
    return next ? [current, next] : [current];
  }, [open, videoUrl, postLink, posterUrl, nextItem]);

  const [activeIndex, setActiveIndex] = useState(0);
  const active = queue[activeIndex];
  const embedUrl = active?.postLink ? buildInstagramEmbed(active.postLink) : null;
  const [videoFailed, setVideoFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setVideoFailed(false);
      setActiveIndex(0);
      setMuted(true);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setBufferedPct(0);
    }
  }, [open, videoUrl, postLink, posterUrl, nextItem]);

  useEffect(() => {
    if (!open) return;
    setVideoFailed(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedPct(0);
  }, [open, active?.videoUrl, active?.postLink]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const buffered = duration > 0 ? Math.min(100, bufferedPct) : 0;
  const sliderStyle = {
    background: `linear-gradient(to right, #ffffff ${progressPct}%, rgba(255,255,255,0.35) ${progressPct}%, rgba(255,255,255,0.35) ${buffered}%, rgba(255,255,255,0.15) ${buffered}%)`,
  } as React.CSSProperties;

  const formatTime = (value: number) => {
    if (!value || !isFinite(value)) return "0:00";
    const total = Math.floor(value);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const nextTime = Number(e.target.value);
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleNext = () => {
    if (activeIndex + 1 < queue.length) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[80] bg-black/70 grid place-items-center" role="dialog" aria-modal>
      <div
        ref={containerRef}
        className="relative h-[92svh] sm:h-[92vh] max-h-[900px] w-auto max-w-[94vw] sm:max-w-[520px] aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-lg"
      >
        <div className="absolute top-[calc(env(safe-area-inset-top)+8px)] right-2 z-10 flex items-center gap-2">
          {active?.postLink ? (
            <a
              href={active.postLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-md text-sm bg-white/90 text-gray-800"
            >
              Ver no Instagram
            </a>
          ) : null}
          <button
            className="px-2 py-1 rounded-md text-sm bg-white/90 text-gray-800"
            onClick={onClose}
            aria-label="Fechar"
          >
            Fechar
          </button>
        </div>
        {active?.videoUrl && !videoFailed ? (
          <video
            ref={videoRef}
            src={active.videoUrl}
            className="w-full h-full object-contain bg-black"
            autoPlay
            playsInline
            preload="metadata"
            muted={muted}
            poster={active.posterUrl}
            onError={() => {
              setVideoFailed(true);
              setIsPlaying(false);
            }}
            onLoadedMetadata={() => {
              const el = videoRef.current;
              if (!el) return;
              setDuration(el.duration || 0);
              setCurrentTime(el.currentTime || 0);
              setMuted(el.muted);
            }}
            onTimeUpdate={() => {
              const el = videoRef.current;
              if (!el) return;
              setCurrentTime(el.currentTime || 0);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onProgress={() => {
              const el = videoRef.current;
              if (!el || !el.buffered?.length || !duration) return;
              const end = el.buffered.end(el.buffered.length - 1);
              setBufferedPct(Math.min(100, (end / duration) * 100));
            }}
            onEnded={() => {
              if (activeIndex + 1 < queue.length) {
                handleNext();
              } else {
                setIsPlaying(false);
              }
            }}
          />
        ) : embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            title="Instagram video"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-white">
            <div className="text-center space-y-3">
              <p>Não foi possível incorporar este vídeo.</p>
              {postLink ? (
                <a href={postLink} target="_blank" rel="noopener noreferrer" className="underline">
                  Abrir no Instagram
                </a>
              ) : null}
            </div>
          </div>
        )}
        {(!active?.videoUrl || videoFailed) && activeIndex + 1 < queue.length ? (
          <div className="absolute bottom-3 right-3">
            <button
              type="button"
              onClick={handleNext}
              className="px-2.5 py-1 rounded bg-white/20 text-white text-xs font-semibold hover:bg-white/30"
            >
              Próximo vídeo
            </button>
          </div>
        ) : null}
        {active?.videoUrl && !videoFailed ? (
          <div className="absolute bottom-0 left-0 right-0 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-gradient-to-t from-black/80 via-black/30 to-transparent">
            <div className="flex items-center gap-2 text-white text-sm">
              <button
                type="button"
                onClick={togglePlay}
                className="px-2 py-1 rounded bg-white/15 hover:bg-white/25"
                aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              >
                {isPlaying ? "Pausar" : "Play"}
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="px-2 py-1 rounded bg-white/15 hover:bg-white/25"
                aria-label={muted ? "Ativar som" : "Mutar"}
              >
                {muted ? "Ativar som" : "Mutar"}
              </button>
              <span className="text-xs tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="ml-auto px-2 py-1 rounded bg-white/15 hover:bg-white/25"
                aria-label="Tela cheia"
              >
                Tela cheia
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="mt-2 w-full accent-white h-1.5"
              style={sliderStyle}
              aria-label="Progresso do vídeo"
            />
            {activeIndex + 1 < queue.length && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-2.5 py-1 rounded bg-white/20 text-white text-xs font-semibold hover:bg-white/30"
                >
                  Próximo vídeo
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
