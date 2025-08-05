'use client';

import { signIn } from 'next-auth/react';
import { FaGoogle } from 'react-icons/fa';
import ButtonPrimary from './ButtonPrimary';
import Container from '../../components/Container';

export default function CallToAction() {
  const handleSignIn = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'sign_in_click');
    }
    signIn('google', { callbackUrl: '/auth/complete-signup' });
  };

  return (
    <section className="snap-start bg-brand-dark text-white">
      <Container padding="py-12 sm:py-20" className="text-left">
        <div className="max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            Pronto para transformar sua criação de conteúdo?
          </h2>
          <p className="mt-4 text-lg md:text-xl text-gray-300 max-w-3xl leading-relaxed">
            Pare de adivinhar e comece a crescer com estratégia. O Mobi está esperando por você.
          </p>
          <div className="mt-10">
            <ButtonPrimary onClick={handleSignIn}>
              <FaGoogle /> Ativar meu estrategista agora ▸
            </ButtonPrimary>
          </div>
        </div>
      </Container>
    </section>
  );
}

