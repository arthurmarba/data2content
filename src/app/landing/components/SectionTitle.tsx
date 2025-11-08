'use client';
import React from 'react';

export default function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-display-lg text-balance text-brand-dark tracking-tight ${className}`}>
      {children}
    </h2>
  );
}
