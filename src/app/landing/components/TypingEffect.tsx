'use client';

import { TypeAnimation } from 'react-type-animation';

interface TypingEffectProps {
  sequence: (string | number)[];
  className?: string;
}

export default function TypingEffect({ sequence, className }: TypingEffectProps) {
  return (
    <TypeAnimation
      sequence={sequence}
      wrapper="p"
      speed={50}
      repeat={Infinity}
      className={className}
    />
  );
}

