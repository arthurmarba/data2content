'use client';

import { signIn } from 'next-auth/react';
import { MAIN_DASHBOARD_ROUTE } from '@/constants/routes';
import { FaGoogle } from 'react-icons/fa';
import ButtonPrimary from './ButtonPrimary';
import Container from '../../components/Container';
import { track } from '@/lib/track';

export default function CallToAction() {
  const handleSignIn = () => {
    track('sign_in_click');
    signIn('google', { callbackUrl: MAIN_DASHBOARD_ROUTE });
  };

  return (
    <section className="snap-start bg-brand-dark text-white">
      <Container padding="py-10 sm:py-16" className="text-left">
        <div className="max-w-3xl">
          <h2 className="text-[2.25rem] font-semibold leading-tight text-white sm:text-[2.5rem] md:text-[2.75rem] lg:text-[3rem]">
            Pronto para transformar sua criação de conteúdo?
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-normal text-gray-300 md:text-lg">
            Pare de adivinhar e comece a crescer com estratégia. O Mobi está esperando por você.
          </p>
          <div className="mt-10">
            <ButtonPrimary onClick={handleSignIn}>
              <FaGoogle aria-hidden="true" /> Ativar meu estrategista agora ▸
            </ButtonPrimary>
          </div>
        </div>
      </Container>
    </section>
  );
}
