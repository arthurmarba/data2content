'use client';

import ButtonPrimary from './ButtonPrimary';
import dynamic from 'next/dynamic';
import Marquee from './Marquee';
import Container from '../../components/Container';

const TypingEffect = dynamic(() => import('./TypingEffect'), { ssr: false });

export default function LegacyHero() {
  return (
    <section className="snap-start relative flex flex-col h-screen pt-20 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 text-center overflow-x-hidden">
      <Container className="flex-grow flex flex-col justify-center">
        <div className="flex flex-col items-center space-y-6">
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-brand-dark">
            O fim da dúvida: o que postar hoje
          </h1>
          <TypingEffect
            sequence={[
              'Uma inteligência artificial',
              1000,
              'conectada ao Instagram',
              1000,
              'que conversa no WhatsApp',
              1000,
            ]}
            className="text-lg md:text-xl text-gray-600"
          />
          <ButtonPrimary href="/login">
            Fazer Login
          </ButtonPrimary>
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/images/tuca-analise-whatsapp.png"
            src="/videos/hero-demo.mp4"
            className="w-full max-w-4xl mx-auto rounded-2xl shadow-xl aspect-video mt-8"
            loading="lazy"
            decoding="async"
          />
        </div>
      </Container>
      <div className="mt-8 space-y-2 overflow-hidden">
        <Marquee direction="left" />
        <Marquee direction="right" />
      </div>
    </section>
  );
}

