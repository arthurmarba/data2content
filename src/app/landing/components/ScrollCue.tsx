'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';

interface ScrollCueProps {
  targetId: string;
  direction?: 'down' | 'up';
}

export function ScrollCue({ targetId, direction = 'down' }: ScrollCueProps) {
  const handleClick = () => {
    const el = document.getElementById(targetId);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <button
      onClick={handleClick}
      aria-label={`Scroll ${direction}`}
      className="absolute left-1/2 -translate-x-1/2 text-brand-dark animate-bounce p-2"
      style={direction === 'down' ? { bottom: '1rem' } : { top: '1rem' }}
    >
      {direction === 'down' ? <ChevronDown size={32} /> : <ChevronUp size={32} />}
    </button>
  );
}

