"use client";

import React, { useEffect } from 'react';

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

export default function DiscoverVideoModal({ open, onClose, postLink }: { open: boolean; onClose: () => void; postLink: string }) {
  const embedUrl = buildInstagramEmbed(postLink);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 grid place-items-center" role="dialog" aria-modal>
      <div className="relative w-[92vw] max-w-2xl aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-lg">
        <button
          className="absolute top-2 right-2 z-10 px-2 py-1 rounded-md text-sm bg-white/90 text-gray-800"
          onClick={onClose}
          aria-label="Fechar"
        >
          Fechar
        </button>
        {embedUrl ? (
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
              <a href={postLink} target="_blank" rel="noopener noreferrer" className="underline">Abrir no Instagram</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

