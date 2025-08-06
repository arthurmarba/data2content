'use client';

import ButtonPrimary from './ButtonPrimary';
import dynamic from 'next/dynamic';
import Marquee from './Marquee';
import Container from '../../components/Container';
import { ScrollCue } from './ScrollCue';

const TypingEffect = dynamic(() => import('./TypingEffect'), { ssr: false });

export default function LegacyHero() {
  return (
    <section className="snap-start relative flex flex-col h-screen pt-24 md:pt-28 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 text-center overflow-x-hidden">
      <Container className="flex-grow flex flex-col justify-center">
        <div className="flex flex-col items-center space-y-8 md:space-y-10">
          <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-tight tracking-tight text-brand-dark">
            O fim da dúvida: o que postar hoje
          </h1>
          <TypingEffect
            sequence={[
              'uma inteligência artificial conectada ao seu Instagram.',
              1000,
              'uma inteligência artificial para conversar no WhatsApp',
              1000,
            ]}
            className="max-w-2xl text-base sm:text-lg md:text-xl text-gray-600"
          />
          <ButtonPrimary href="/login">
            Ative sua IA do Instagram no WhatsApp
          </ButtonPrimary>
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/images/tuca-analise-whatsapp.png"
            src="/videos/hero-demo.mp4"
            className="w-full max-w-4xl mx-auto rounded-2xl shadow-xl aspect-video"
            loading="lazy"
            decoding="async"
          />
        </div>
      </Container>
      <div className="mt-10 space-y-2 overflow-hidden">
        <Marquee direction="left" />
        <Marquee direction="right" />
      </div>
      <div className="relative mt-8 h-12">
        <ScrollCue targetId="intro" />
      </div>
    </section>
  );
}

