/**
 * @fileoverview Componente reutilizável para exibir um placeholder de carregamento (skeleton).
 * @version 1.0.0
 */
import React from 'react';

interface SkeletonBlockProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'rectangle' | 'circle';
}

const SkeletonBlock = ({
  width = 'w-full',
  height = 'h-4',
  className = '',
  variant = 'rectangle',
}: SkeletonBlockProps) => {
  const baseClasses = "bg-gray-200 dark:bg-gray-700 animate-pulse";
  const shapeClass = variant === 'circle' ? 'rounded-full' : 'rounded';
  return <div className={`${baseClasses} ${width} ${height} ${shapeClass} ${className}`}></div>;
};

export default SkeletonBlock;
