'use client';
import React from 'react';

export default function SectionSubtitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mt-4 text-lg md:text-xl text-gray-600 max-w-3xl leading-relaxed ${className}`}>{children}</p>
  );
}
