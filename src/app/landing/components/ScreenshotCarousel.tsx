'use client';

import Image from 'next/image';
import React, { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { altTextService } from '@/services/altTextService';

interface Screenshot {
  title: string;
  imageUrl: string;
  description: string;
}

interface ScreenshotCarouselProps {
  items: Screenshot[];
}

// Cartão individual do carrossel de screenshots
const ScreenshotCard = ({ imageUrl, title, description }: Screenshot) => (
  <div
    tabIndex={0}
    aria-label={title}
    className="flex-shrink-0 w-[60vw] sm:w-[40vw] md:w-[28vw] lg:w-[22vw] rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 p-1 shadow-2xl"
  >
    <motion.div
      className="relative w-full h-full bg-white rounded-[22px] shadow-inner overflow-hidden"
      whileTap={{ scale: 0.98, transition: { duration: 0.2 } }}
    >
      <Image
        src={imageUrl}
        alt={altTextService(title, description)}
        width={1080}
        height={2240}
        className="rounded-[22px] w-full h-auto"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src =
            'https://placehold.co/360x640/f0f0f0/333?text=Imagem+Indisponível';
        }}
      />
    </motion.div>
  </div>
);

// --- COMPONENTE PRINCIPAL (COM A LÓGICA DO CARROSSEL) ---
export default function ScreenshotCarousel({ items }: ScreenshotCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const { scrollX } = useScroll({ container: carouselRef });

  useMotionValueEvent(scrollX, 'change', (latest) => {
    const card = carouselRef.current?.children[0] as HTMLElement;
    const cardWidth = card?.offsetWidth || 0;
    const gap = 32;
    if (cardWidth === 0) return;
    const index = Math.round(latest / (cardWidth + gap));
    if (index >= 0 && index < items.length) {
      setActiveIndex(index);
    }
  });

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const card = carouselRef.current.children[0] as HTMLElement;
      const cardWidth = card?.offsetWidth || 0;
      const gap = 32;
      const scrollAmount = cardWidth + gap;
      carouselRef.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollCarousel('right');
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollCarousel('left');
    }
  };

  return (
    <div
      className="relative mt-6"
      onKeyDown={handleKeyDown}
      aria-label={`Carrossel de screenshots, slide ${activeIndex + 1} de ${items.length}`}
    >
      <div
        ref={carouselRef}
        className="overflow-x-auto snap-x snap-mandatory hide-scrollbar"
        onTouchStart={(e) => {
          // CORREÇÃO: Garante que o objeto touch existe antes de usá-lo
          const touch = e.touches[0];
          if (touch) {
            setTouchStart(touch.clientX);
          }
        }}
        onTouchEnd={(e) => {
          if (touchStart === null) return;
          
          // CORREÇÃO: Garante que o objeto touch existe antes de usá-lo
          const touch = e.changedTouches[0];
          if (!touch) return;

          const deltaX = touch.clientX - touchStart;
          if (deltaX < -50) {
            scrollCarousel('right');
          } else if (deltaX > 50) {
            scrollCarousel('left');
          }
          setTouchStart(null);
        }}
      >
        <div
          className="flex gap-8 items-start" // Usar items-start para alinhar pelo topo
          style={{
            paddingTop: '1.5rem',
            paddingBottom: '1.5rem',
            paddingLeft: 'calc(max(0px, (100vw - 1280px) / 2) + 1.5rem)',
            paddingRight: 'calc(max(0px, (100vw - 1280px) / 2) + 1.5rem)',
          }}
        >
          {items.map((item, index) => (
            <div key={index} className="flex flex-col items-start gap-2 flex-shrink-0 snap-center">
              <h3 className="font-bold text-lg text-gray-600 pl-1">{item.title}</h3>
              <ScreenshotCard
                imageUrl={item.imageUrl}
                title={item.title}
                description={item.description}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-4 pointer-events-none">
        <button
          onClick={() => scrollCarousel('left')}
          tabIndex={-1} // Removido do foco do teclado para evitar duplicidade
          className="pointer-events-auto w-12 h-12 rounded-full bg-white/50 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
          aria-label="Anterior"
        >
          <FaChevronLeft />
        </button>
        <button
          onClick={() => scrollCarousel('right')}
          tabIndex={-1} // Removido do foco do teclado para evitar duplicidade
          className="pointer-events-auto w-12 h-12 rounded-full bg-white/50 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
          aria-label="Próximo"
        >
          <FaChevronRight />
        </button>
      </div>
      <p
        className="mt-4 text-center text-gray-600 max-w-md mx-auto"
        aria-live="polite"
        aria-label={`Slide ${activeIndex + 1} de ${items.length}: ${items[activeIndex]?.description}`}
      >
        {items[activeIndex]?.description}
      </p>
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
      `}</style>
    </div>
  );
}