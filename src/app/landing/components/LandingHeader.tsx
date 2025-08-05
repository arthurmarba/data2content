'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import ButtonPrimary from './ButtonPrimary';
import Container from '../../components/Container';

interface LandingHeaderProps {
  showLoginButton?: boolean;
}

export default function LandingHeader({ showLoginButton = false }: LandingHeaderProps) {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);

  const trackEvent = (eventName: string) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName);
    }
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 w-full z-50 backdrop-blur-md transition-all ${isScrolled ? 'bg-white shadow' : 'bg-white/60'}`}>
      <Container className="flex justify-between items-center h-20">
        <Link href="/" className="font-bold text-2xl text-brand-dark flex items-center gap-2">
          <span className="text-brand-pink">[2]</span>
          <span>data2content</span>
        </Link>
        <nav className="flex items-center gap-5">
          {session ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-gray-600 hover:text-brand-pink transition-colors"
            >
              Meu Painel
            </Link>
          ) : showLoginButton ? (
            <ButtonPrimary href="/login" onClick={() => trackEvent('login_button_click')}>
              Fazer Login
            </ButtonPrimary>
          ) : (
            <Link
              href="/login"
              onClick={() => trackEvent('login_link_click')}
              className="text-sm font-semibold text-gray-600 hover:text-brand-pink transition-colors"
            >
              Fazer Login
            </Link>
          )}
          <ButtonPrimary href="/register" onClick={() => trackEvent('cta_start_now_click')}>
            Começar Agora
          </ButtonPrimary>
        </nav>
      </Container>
    </header>
  );
}

