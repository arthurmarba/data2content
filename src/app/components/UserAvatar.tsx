// src/app/components/UserAvatar.tsx
'use client';

import Image from 'next/image';
import React from 'react';
import { getProxiedImageUrl, isBlockedHost } from '@/utils/imageUtils';

interface UserAvatarProps {
  name?: string;
  src?: string | null;
  fallbackSrc?: string | null;
  size?: number;
  className?: string;
  fit?: 'cover' | 'contain';
  fillContainer?: boolean;
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
  fit = 'cover',
  fillContainer = false,
}: UserAvatarProps) {
  const [errored, setErrored] = React.useState(false);
  const [hasTriedFallback, setHasTriedFallback] = React.useState(false);
  const [activeSrc, setActiveSrc] = React.useState<string | null>(src ?? null);
  const showImage = !!activeSrc && !errored;

  const initials = getInitials(name);
  const isCircular = !className.includes('rounded-');
  const borderRadiusClass = isCircular ? 'rounded-full' : '';
  const baseClasses = `${borderRadiusClass} ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`;
  const sharedStyle = fillContainer ? undefined : { width: size, height: size };

  React.useEffect(() => {
    setActiveSrc(src ?? null);
    setHasTriedFallback(false);
    setErrored(false);
  }, [src, fallbackSrc]);

  if (!showImage) {
    return (
      <div
        className={`flex items-center justify-center ${borderRadiusClass} bg-gradient-to-br from-pink-500 to-pink-600 text-white font-semibold select-none ${className}`}
        style={{
          ...(fillContainer ? { width: '100%', height: '100%' } : { width: size, height: size }),
          fontSize: Math.max(12, Math.floor(size / 3)),
        }}
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

  // Usa o utilitário compartilhado para obter a URL proxied se necessário
  // O utilitário já lida com isBlockedHost e a adição dos parametros correta
  const imgSrc = getProxiedImageUrl(activeSrc as string) || (activeSrc as string);

  const isExternal = /^https?:\/\//i.test(imgSrc);
  const useImgTag = imgSrc.startsWith('/api/mediakit/') || isExternal;
  const referrerPolicy = isExternal ? undefined : 'no-referrer';
  const crossOrigin = isExternal ? undefined : 'anonymous';

  if (useImgTag) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgSrc}
        alt={`Avatar de ${name}`}
        width={size}
        height={size}
        className={baseClasses}
        style={sharedStyle}
        loading="lazy"
        draggable={false}
        onError={handleFailure}
        onLoad={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          if (el.naturalWidth <= 2 && el.naturalHeight <= 2) {
            handleFailure();
          }
        }}
      />
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={`Avatar de ${name}`}
      unoptimized={imgSrc.includes('/api/proxy')}
      width={size}
      height={size}
      className={baseClasses}
      style={sharedStyle}
      loading="lazy"
      draggable={false}
      referrerPolicy={referrerPolicy}
      crossOrigin={crossOrigin}
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
