'use client';

import Link from 'next/link';
import React from 'react';

interface ButtonPrimaryProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export default function ButtonPrimary({ href, onClick, children, className = '' }: ButtonPrimaryProps) {
  const commonClasses = `group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-brand-pink to-brand-red px-8 py-4 text-lg font-bold text-white shadow-lg shadow-pink-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/40 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 ${className}`;
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={commonClasses}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={commonClasses}>
      {children}
    </button>
  );
}

