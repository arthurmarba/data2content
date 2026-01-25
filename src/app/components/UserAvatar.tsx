// src/app/components/UserAvatar.tsx
'use client';

import Image from 'next/image';
import React from 'react';

interface UserAvatarProps {
  name?: string;
  src?: string | null;
  fallbackSrc?: string | null;
  size?: number;
  className?: string;
}

function isBlockedHost(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith('fbcdn.net') ||
      host.endsWith('xx.fbcdn.net') ||
      host.endsWith('cdninstagram.com') ||
      host.endsWith('instagram.com') ||
      host.endsWith('fbsbx.com') ||
      host.endsWith('facebook.com')
    );
  } catch {
    return false;
  }
}

function getInitials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return (letters || (name ?? '?')[0] || '?').toUpperCase();
}

export function UserAvatar({
  name = 'Criador',
  src,
  fallbackSrc,
  size = 40,
  className = '',
}: UserAvatarProps) {
  const [errored, setErrored] = React.useState(false);
  const [hasTriedFallback, setHasTriedFallback] = React.useState(false);
  const [activeSrc, setActiveSrc] = React.useState<string | null>(src ?? null);
  const showImage = !!activeSrc && !errored;

  const initials = getInitials(name);
  const isCircular = !className.includes('rounded-');
  const borderRadiusClass = isCircular ? 'rounded-full' : '';
  const baseClasses = `${borderRadiusClass} object-cover ${className}`;

  React.useEffect(() => {
    setActiveSrc(src ?? null);
    setHasTriedFallback(false);
    setErrored(false);
  }, [src, fallbackSrc]);

  if (!showImage) {
    return (
      <div
        className={`flex items-center justify-center ${borderRadiusClass} bg-gradient-to-br from-pink-500 to-pink-600 text-white font-semibold select-none ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(12, Math.floor(size / 3)) }}
        aria-label={name}
        title={name}
      >
        {initials}
      </div>
    );
  }

  const handleFailure = () => {
    if (fallbackSrc && !hasTriedFallback && activeSrc !== fallbackSrc) {
      setHasTriedFallback(true);
      setErrored(false);
      setActiveSrc(fallbackSrc);
      return;
    }
    setErrored(true);
  };

  // Para hosts do Instagram/Facebook, preferimos usar nosso proxy para evitar 403
  let imgSrc = activeSrc as string;
  if (isBlockedHost(activeSrc || undefined)) {
    if (!imgSrc.startsWith('/api/proxy/thumbnail/')) {
      imgSrc = `/api/proxy/thumbnail/${encodeURIComponent(imgSrc)}`;
    }
  }

  // Solicita modo estrito ao proxy (se já estiver usando) para evitar PNG 1x1 silencioso
  if (imgSrc.startsWith('/api/proxy/thumbnail/')) {
    imgSrc = imgSrc.includes('?') ? `${imgSrc}&strict=1` : `${imgSrc}?strict=1`;
  }

  return (
    <Image
      src={imgSrc}
      alt={`Avatar de ${name}`}
      unoptimized
      width={size}
      height={size}
      className={baseClasses}
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onError={handleFailure}
      onLoad={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        // Se o proxy devolveu um fallback 1x1 (em modo não estrito), trata como erro
        if (el.naturalWidth <= 2 && el.naturalHeight <= 2) {
          handleFailure();
        }
      }}
    />
  );
}
