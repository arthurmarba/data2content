"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const VideoHeader = React.memo(({
  onReviewClick,
  onClose,
  postLink
}: {
  onReviewClick?: () => void;
  onClose: () => void;
  postLink?: string;
}) => (
  <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
    <div className="flex items-center gap-2">
      {onReviewClick && (
        <button
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors uppercase tracking-wider"
          onClick={onReviewClick}
        >
          Revisar
        </button>
      )}
      {postLink && (
        <a
          href={postLink}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors backdrop-blur-md uppercase tracking-wider"
        >
          Ver no Instagram
        </a>
      )}
    </div>
    <button
      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors backdrop-blur-md uppercase tracking-wider"
      onClick={onClose}
      aria-label="Fechar"
    >
      Fechar
    </button>
  </div>
));
VideoHeader.displayName = 'VideoHeader';

const VideoControls = React.memo(({
  isPlaying,
  muted,
  currentTime,
  duration,
  bufferedPct,
  onTogglePlay,
  onToggleMute,
  onToggleFullscreen,
  onSeek,
  onNext,
  showNext,
}: {
  isPlaying: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  bufferedPct: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNext: () => void;
  showNext: boolean;
}) => {
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const buffered = duration > 0 ? Math.min(100, bufferedPct) : 0;

  const sliderStyle = useMemo(() => ({
    background: `linear-gradient(to right, #ffffff ${progressPct}%, rgba(255,255,255,0.35) ${progressPct}%, rgba(255,255,255,0.35) ${buffered}%, rgba(255,255,255,0.15) ${buffered}%)`,
  }), [progressPct, buffered]);

  const formatTime = (value: number) => {
    if (!value || !isFinite(value)) return "0:00";
    const total = Math.floor(value);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-gradient-to-t from-black/80 via-black/30 to-transparent">
      <div className="flex items-center gap-2 text-white text-sm">
        <button
          type="button"
          onClick={onTogglePlay}
          className="px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition-colors"
          aria-label={isPlaying ? "Pausar" : "Reproduzir"}
        >
          {isPlaying ? "Pausar" : "Play"}
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          className="px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition-colors"
          aria-label={muted ? "Ativar som" : "Mutar"}
        >
          {muted ? "Ativar som" : "Mutar"}
        </button>
        <span className="text-xs tabular-nums opacity-80">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="ml-auto px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition-colors"
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
        onChange={onSeek}
        className="mt-2 w-full accent-white h-1.5 cursor-pointer"
        style={sliderStyle}
        aria-label="Progresso do vídeo"
      />
      {showNext && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onNext}
            className="px-2.5 py-1 rounded bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-all active:scale-95"
          >
            Próximo vídeo
          </button>
        </div>
      )}
    </div>
  );
});
VideoControls.displayName = 'VideoControls';

export default function DiscoverVideoModal({
  open,
  onClose,
  postLink,
  videoUrl,
  posterUrl,
  nextItem,
  onReviewClick,
}: {
  open: boolean;
  onClose: () => void;
  postLink?: string;
  videoUrl?: string;
  posterUrl?: string;
  onReviewClick?: () => void;
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
    const current = { id: "current", videoUrl, postLink, posterUrl };
    const next = nextItem ? { ...nextItem } : null;
    return next ? [current, next] : [current];
  }, [open, videoUrl, postLink, posterUrl, nextItem]);

  const [activeIndex, setActiveIndex] = useState(0);
  const active = queue[activeIndex];
  const embedUrl = useMemo(() => active?.postLink ? buildInstagramEmbed(active.postLink) : null, [active?.postLink]);

  const [videoFailed, setVideoFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

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

  const handleNext = useCallback(() => {
    if (activeIndex + 1 < queue.length) {
      setActiveIndex(activeIndex + 1);
    }
  }, [activeIndex, queue.length]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => { });
    else el.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => { });
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const time = Number(e.target.value);
    el.currentTime = time;
    setCurrentTime(time);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'ArrowRight':
          if (videoRef.current) videoRef.current.currentTime += 5;
          break;
        case 'ArrowLeft':
          if (videoRef.current) videoRef.current.currentTime -= 5;
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, togglePlay, toggleMute, toggleFullscreen, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !mounted) return null;

  const modal = (
    <div className="fixed inset-0 z-[80] bg-black/70 grid place-items-center" role="dialog" aria-modal>
      <div
        ref={containerRef}
        className="relative h-[92svh] sm:h-[92vh] max-h-[900px] w-auto max-w-[94vw] sm:max-w-[520px] aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-lg"
      >
        <VideoHeader
          onReviewClick={onReviewClick}
          onClose={onClose}
          postLink={active?.postLink}
        />

        {active?.videoUrl && !videoFailed ? (
          <video
            ref={videoRef}
            src={active.videoUrl}
            className="w-full h-full object-contain bg-black"
            autoPlay
            playsInline
            preload="auto"
            muted={muted}
            poster={active.posterUrl}
            onError={() => { setVideoFailed(true); setIsPlaying(false); }}
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
              if (activeIndex + 1 < queue.length) handleNext();
              else setIsPlaying(false);
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
            <div className="text-center space-y-3 px-6">
              <p className="opacity-60">Não foi possível incorporar este vídeo.</p>
              {active?.postLink && (
                <a href={active.postLink} target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-400">
                  Abrir no Instagram
                </a>
              )}
            </div>
          </div>
        )}

        {active?.videoUrl && !videoFailed ? (
          <VideoControls
            isPlaying={isPlaying}
            muted={muted}
            currentTime={currentTime}
            duration={duration}
            bufferedPct={bufferedPct}
            onTogglePlay={togglePlay}
            onToggleMute={toggleMute}
            onToggleFullscreen={toggleFullscreen}
            onSeek={handleSeek}
            onNext={handleNext}
            showNext={activeIndex + 1 < queue.length}
          />
        ) : activeIndex + 1 < queue.length ? (
          <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+12px)] right-3 z-30">
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
            >
              Próximo vídeo
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
