'use client';

import React from 'react';

interface SkeletonBlockProps {
  className?: string;
  width?: string; // e.g., 'w-3/4', 'w-full'
  height?: string; // e.g., 'h-4', 'h-8'
  variant?: 'text' | 'circle' | 'rectangle'; // For different shapes
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  className = '',
  width = 'w-full',
  height = 'h-4', // Default height similar to a line of text
  variant = 'text',
}) => {
  const baseClasses = "animate-pulse bg-gray-200 dark:bg-gray-700";

  let shapeClasses = 'rounded-md'; // Default for text and rectangle
  if (variant === 'circle') {
    shapeClasses = 'rounded-full';
  } else if (variant === 'text' && !className.includes('rounded-')) {
    // Text usually has slightly less rounded corners unless specified
    shapeClasses = 'rounded';
  }

  return (
    <div
      className={`${baseClasses} ${shapeClasses} ${height} ${width} ${className}`}
      aria-busy="true"
      aria-live="polite"
    />
  );
};

export default SkeletonBlock;
