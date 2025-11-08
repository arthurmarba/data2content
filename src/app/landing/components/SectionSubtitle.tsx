'use client';
import React from 'react';

export default function SectionSubtitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`mt-4 max-w-3xl text-body-lg font-normal text-brand-text-secondary/90 leading-relaxed ${className}`}
    >
      {children}
    </p>
  );
}
