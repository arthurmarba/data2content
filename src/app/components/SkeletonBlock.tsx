'use client';

import React from 'react';

interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'rectangle' | 'circle';
}

/**
 * Componente para exibir um bloco de skeleton placeholder.
 * @param {string | number} width - Largura do bloco. Padrão: '100%'.
 * @param {string | number} height - Altura do bloco. Padrão: '24px'.
 * @param {string} className - Classes CSS adicionais.
 * @param {'rectangle' | 'circle'} variant - Formato do bloco. Padrão: 'rectangle'.
 */
export function SkeletonBlock({
  width = '100%',
  height = '24px',
  className = '',
  variant = 'rectangle',
}: SkeletonBlockProps) {
  const shapeClass = variant === 'circle' ? 'rounded-full' : 'rounded-md';
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${shapeClass} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      role="status"
      aria-busy="true"
    />
  );
}
