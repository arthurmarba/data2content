'use client';

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import { motion, PanInfo, useMotionValueEvent, useScroll } from 'framer-motion';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface Screenshot {
  title: string;
  imageUrl: string;
  description: string;
}

interface ScreenshotCarouselProps {
  items: Screenshot[];
}

export default function ScreenshotCarousel({ items }: ScreenshotCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
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

  const ScreenshotCard = ({ imageUrl, title }: { imageUrl: string; title: string }) => {
    const [isTouch, setIsTouch] = useState(false);

    useEffect(() => {
      const handlePointerDown = (e: PointerEvent) => {
        setIsTouch(e.pointerType === 'touch');
      };
      window.addEventListener('pointerdown', handlePointerDown, { once: true });
      return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    return (
      <div
        className="flex-shrink-0 w-[60vw] sm:w-[40vw] md:w-[28vw] lg:w-[22vw] aspect-[9/16] rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 p-1 shadow-2xl cursor-grab active:cursor-grabbing"
        style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
      >
        <motion.div
          className="relative w-full h-full bg-white rounded-[22px] shadow-inner overflow-hidden"
          whileTap={{ scale: 0.98, transition: { duration: 0.2 } }}
          whileHover={isTouch ? undefined : { rotateX: 5, rotateY: -5 }}
        >
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/360x640/f0f0f0/333?text=Imagem+Indispon\u00edvel';
            }}
          />
        </motion.div>
      </div>
    );
  };

  return (
    <div className="relative mt-6">
      <motion.div
        ref={carouselRef}
        className="overflow-hidden snap-x snap-mandatory hide-scrollbar"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.05}
        style={{ touchAction: 'pan-y' }}
        onDragEnd={(event, info: PanInfo) => {
          const pointerEvent = event as PointerEvent;
          if (pointerEvent.pointerType !== 'touch') return;
          if (info.offset.x < -50) {
            scrollCarousel('right');
          } else if (info.offset.x > 50) {
            scrollCarousel('left');
          }
        }}
      >
        <div
          className="flex gap-8"
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
              <ScreenshotCard imageUrl={item.imageUrl} title={item.title} />
            </div>
          ))}
        </div>
      </motion.div>
      <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-4 pointer-events-none">
        <button
          onClick={() => scrollCarousel('left')}
          className="pointer-events-auto w-12 h-12 rounded-full bg-white/50 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
          aria-label="Anterior"
        >
          <FaChevronLeft />
        </button>
        <button
          onClick={() => scrollCarousel('right')}
          className="pointer-events-auto w-12 h-12 rounded-full bg-white/50 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
          aria-label="Pr\u00f3ximo"
        >
          <FaChevronRight />
        </button>
      </div>
      <p className="mt-4 text-center text-gray-600 max-w-md mx-auto">{items[activeIndex]?.description}</p>
    </div>
  );
}

