'use client';

import ButtonPrimary from './ButtonPrimary';
import dynamic from 'next/dynamic';
import Marquee from './Marquee';
import Container from '../../components/Container';
import { ScrollCue } from './ScrollCue';
import { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';

const TypingEffect = dynamic(() => import('./TypingEffect'), { ssr: false });

export default function LegacyHero() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { ref: inViewRef, inView } = useInView({ triggerOnce: true, threshold: 0.25 });
  const setRefs = (node: HTMLVideoElement) => {
    videoRef.current = node;
    inViewRef(node);
  };
  const [shouldLoad, setShouldLoad] = useState(false);
  const [reducedData, setReducedData] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-data: reduce)');
    setReducedData(media.matches);
  }, []);

  useEffect(() => {
    if (inView && !reducedData) {
      setShouldLoad(true);
    }
  }, [inView, reducedData]);

  useEffect(() => {
    if (shouldLoad && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [shouldLoad]);

  const handlePlay = () => {
    setShouldLoad(true);
    videoRef.current?.play();
  };

  return (
    <section className="snap-start relative flex flex-col h-screen pt-20 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 text-center overflow-x-hidden">
      <Container className="flex-grow flex flex-col justify-center">
        <div className="flex flex-col items-center space-y-6">
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-brand-dark">
            O fim da dúvida: o que postar hoje
          </h1>
          <TypingEffect
            sequence={[
              'uma inteligência artificial conectada ao seu Instagram.',
              1000,
              'uma inteligência artificial para conversar no WhatsApp',
              1000,
            ]}
            className="text-lg md:text-xl text-gray-600"
          />
          <ButtonPrimary href="/login" rel="nofollow">
            Ative sua IA do Instagram no WhatsApp
          </ButtonPrimary>
          <video
            ref={setRefs}
            autoPlay={!reducedData}
            muted
            loop
            playsInline
            poster="/images/tuca-analise-whatsapp.png"
            preload="none"
            src={shouldLoad ? '/videos/hero-demo.mp4' : undefined}
            className="w-full max-w-4xl mx-auto rounded-2xl shadow-xl aspect-video mt-8"
            aria-label="Demonstração da IA analisando conversas no WhatsApp"
          >
            <track
              kind="captions"
              src="/hero-transcript.vtt"
              label="Português"
              default
            />
          </video>
          <p className="mt-2 text-sm text-gray-600">
            Vídeo demonstrando a IA do Instagram analisando conversas no WhatsApp.
            <a href="/hero-transcript.vtt" className="ml-1 underline">
              Transcrição do vídeo
            </a>
          </p>
          {reducedData && !shouldLoad && (
            <button
              type="button"
              onClick={handlePlay}
              className="mt-4 px-4 py-2 rounded bg-brand-dark text-white"
            >
              Assistir vídeo
            </button>
          )}
        </div>
      </Container>
      <div className="mt-8 space-y-2 overflow-hidden">
        <Marquee direction="left" />
        <Marquee direction="right" />
      </div>
      <div className="relative mt-6 h-12">
        <ScrollCue targetId="intro" />
      </div>
    </section>
  );
}

