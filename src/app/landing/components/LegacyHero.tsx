'use client';

import dynamic from 'next/dynamic';
import ButtonPrimary from './ButtonPrimary';

const HeroVideo = dynamic(() => import('./HeroVideo'), {
  ssr: false,
  loading: () => (
    <img
      src="/images/tuca-analise-whatsapp.png"
      alt="Demonstração do produto"
      className="w-full max-w-4xl mx-auto rounded-2xl shadow-xl aspect-video"
    />
  ),
});

export default function LegacyHero() {
  return (
    <section className="snap-start relative flex flex-col h-screen pt-20 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 text-center overflow-x-hidden">
      <div className="flex-grow flex flex-col justify-center px-6">
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-brand-dark">
          O fim da dúvida: o que postar hoje
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-600">
          Uma inteligência artificial conectada ao Instagram e conversa no WhatsApp
        </p>
        <ButtonPrimary href="/login" className="mt-8">
          Fazer Login
        </ButtonPrimary>
        <div className="mt-12">
          <HeroVideo />
        </div>
      </div>
    </section>
  );
}

