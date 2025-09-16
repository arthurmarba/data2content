'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useAnimation, useMotionValue } from 'framer-motion';

// --- HOOKS AUXILIARES ---
function useDebounce(callback: () => void, delay: number) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = setTimeout(() => {
      callbackRef.current();
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [delay]);
}

// --- ÍCONES PARA OS BOTÕES ---
const ChevronIcon = ({ direction }: { direction: 'left' | 'right' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24"
    strokeWidth={2.5}
    stroke="currentColor"
    className={`w-6 h-6 text-black ${direction === 'right' ? '' : 'transform rotate-180'}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// --- TIPOS ---
type ImgItem = { src: string; alt?: string };
interface WhatsAppCarouselProps {
  items?: ImgItem[];
}

// --- COMPONENTE PRINCIPAL ---
export default function WhatsAppCarousel({ items }: WhatsAppCarouselProps) {
  const defaultItems: ImgItem[] =
    items ?? [
      { src: '/images/WhatsApp Image 2025-07-07 at 14.00.20.png' },
      { src: '/images/WhatsApp Image 2025-07-07 at 14.00.20 (1).png' },
      { src: '/images/WhatsApp Image 2025-07-07 at 14.00.21.png' },
      { src: '/images/WhatsApp Image 2025-07-07 at 14.00.21 (1).png' },
      { src: '/images/WhatsApp Image 2025-07-07 at 14.00.21 (2).png' },
      { src: '/images/WhatsApp Image 2025-07-07 at 14.00.21 (3).png' },
    ];

  const carouselRef = useRef<HTMLUListElement>(null);
  const controls = useAnimation();
  const x = useMotionValue(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [totalWidth, setTotalWidth] = useState(0);
  
  const calculateDimensions = useCallback(() => {
    if (carouselRef.current) {
        setCarouselWidth(carouselRef.current.offsetWidth);
        setTotalWidth(carouselRef.current.scrollWidth);
    }
  }, []);

  useDebounce(calculateDimensions, 250);

  useEffect(() => {
    calculateDimensions();
    window.addEventListener('resize', calculateDimensions);
    return () => window.removeEventListener('resize', calculateDimensions);
  }, [calculateDimensions, defaultItems.length]);

  const navigateTo = useCallback(
    (index: number) => {
      const newIndex = Math.max(0, Math.min(index, defaultItems.length - 1));
      if (!carouselRef.current) return;

      const targetChild = carouselRef.current.children[newIndex] as HTMLElement;

      if (targetChild) {
        const newX = -targetChild.offsetLeft;
        
        controls.start({
          x: newX,
          transition: { type: 'spring', stiffness: 300, damping: 30 },
        });
        setActiveIndex(newIndex);
      }
    },
    [controls, defaultItems.length]
  );
  
  const handleNext = () => navigateTo(activeIndex + 1);
  const handlePrev = () => navigateTo(activeIndex - 1);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    }
  };

  const dragConstraint = totalWidth > carouselWidth ? totalWidth - carouselWidth : 0;
  
  useEffect(() => {
    const unsubscribeX = x.onChange((latestX) => {
        if (!carouselRef.current) return;
        const offsets = Array.from(carouselRef.current.children).map(child => (child as HTMLElement).offsetLeft);

        if (offsets.length === 0) return;

        const closestIndex = offsets.reduce((closest, offset, index) => {
            const dist = Math.abs(latestX + offset);
            // CORREÇÃO FINAL APLICADA AQUI
            const closestDist = Math.abs(latestX + offsets[closest]!);
            return dist < closestDist ? index : closest;
        }, 0);

        if (closestIndex !== activeIndex) {
            setActiveIndex(closestIndex);
        }
    });
    return () => unsubscribeX();
  }, [x, activeIndex]);

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < defaultItems.length - 1;

  return (
    <div
      className="w-full flex flex-col items-center"
      role="region"
      aria-roledescription="carousel"
      aria-label="Conversas de exemplo no WhatsApp"
    >
      <div 
        className="relative w-full max-w-4xl lg:max-w-6xl"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="overflow-hidden cursor-grab">
          <motion.ul
            ref={carouselRef}
            className="flex gap-4"
            whileTap={{ cursor: 'grabbing' }}
            drag="x"
            dragConstraints={{ left: -dragConstraint, right: 0 }}
            dragTransition={{ bounceStiffness: 400, bounceDamping: 20 }}
            animate={controls}
            style={{ x }}
            onPointerDown={() => setHasInteracted(true)}
          >
            {defaultItems.map((item, idx) => (
              <li
                key={item.src + idx}
                className="flex-shrink-0 w-[80%] sm:w-[60%] md:w-[45%] lg:w-[40%]"
                role="group"
                aria-roledescription="slide"
                aria-label={`${idx + 1} de ${defaultItems.length}`}
              >
                <div className="relative w-full aspect-[9/16] rounded-xl bg-black/5 ring-1 ring-black/10 overflow-hidden shadow-lg">
                  <Image 
                    src={item.src} 
                    alt={item.alt ?? `Conversa WhatsApp ${idx + 1}`} 
                    fill 
                    className="object-cover"
                    priority={idx < 2} 
                    sizes="(max-width: 640px) 80vw, (max-width: 768px) 60vw, (max-width: 1024px) 45vw, 40vw"
                  />
                </div>
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Gradientes sutis para sugerir continuidade */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-brand-purple/10 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-brand-purple/10 to-transparent" />

        {/* Dica de interação */}
        {!hasInteracted && (
          <div className="pointer-events-none absolute bottom-2 right-4 bg-black/40 text-white text-[11px] px-2 py-1 rounded-full backdrop-blur-sm">
            Arraste →
          </div>
        )}

        {canGoPrev && (
          <button
            onClick={handlePrev}
            aria-label="Slide anterior"
            className="absolute top-1/2 -left-4 md:-left-6 -translate-y-1/2 z-10 p-2 bg-white/70 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-all"
          >
            <ChevronIcon direction="left" />
          </button>
        )}
        {canGoNext && (
          <button
            onClick={handleNext}
            aria-label="Próximo slide"
            className="absolute top-1/2 -right-4 md:-right-6 -translate-y-1/2 z-10 p-2 bg-white/70 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-all"
          >
            <ChevronIcon direction="right" />
          </button>
        )}
      </div>

      <div className="flex justify-center gap-2 mt-6">
        {defaultItems.map((_, idx) => (
          <button
            key={idx}
            onClick={() => navigateTo(idx)}
            aria-label={`Ir para o slide ${idx + 1}`}
            className={`w-2 h-2 rounded-full transition-colors ${
              activeIndex === idx ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
