'use client';

import ButtonPrimary from './ButtonPrimary';
import { TypeAnimation } from 'react-type-animation';
import Marquee from './Marquee';

export default function LegacyHero() {
  return (
    <section className="snap-start relative flex flex-col h-screen pt-20 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 text-center overflow-x-hidden">
      <div className="flex-grow flex flex-col justify-center px-6">
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-brand-dark">
          O fim da dúvida: o que postar hoje
        </h1>
        <TypeAnimation
          sequence={[
            'Uma inteligência artificial',
            1000,
            'conectada ao Instagram',
            1000,
            'que conversa no WhatsApp',
            1000,
          ]}
          wrapper="p"
          speed={50}
          repeat={Infinity}
          className="mt-4 text-lg md:text-xl text-gray-600"
        />
        <ButtonPrimary href="/login" className="mt-8">
          Fazer Login
        </ButtonPrimary>
        <div className="mt-12">
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
      </div>
      <div className="mt-8 space-y-2 overflow-hidden">
        <Marquee direction="left" />
        <Marquee direction="right" />
      </div>
    </section>
  );
}

