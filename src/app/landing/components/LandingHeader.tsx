'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import ButtonPrimary from './ButtonPrimary';
import Container from '../../components/Container';

interface LandingHeaderProps {
  showLoginButton?: boolean;
}

export default function LandingHeader({ showLoginButton = false }: LandingHeaderProps) {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

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

  useEffect(() => {
    if (isMenuOpen) {
      firstLinkRef.current?.focus();
    } else {
      menuButtonRef.current?.focus();
    }
  }, [isMenuOpen]);

  return (
    <header className={`fixed top-0 w-full z-50 backdrop-blur-md transition-all ${isScrolled ? 'bg-white shadow' : 'bg-white/60'}`}>
      <Container className="flex justify-between items-center h-20 relative">
        <Link href="/" className="font-bold text-2xl text-brand-dark flex items-center gap-2">
          <span className="text-brand-pink">[2]</span>
          <span>data2content</span>
        </Link>
        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-5">
            {session ? (
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-gray-600 hover:text-brand-pink transition-colors"
              >
                Meu Painel
              </Link>
            ) : showLoginButton ? (
              <ButtonPrimary
                href="/login"
                onClick={() => trackEvent('login_button_click')}
                rel="nofollow"
              >
                Ative sua IA do Instagram no WhatsApp
              </ButtonPrimary>
            ) : (
              <Link
                href="/login"
                onClick={() => trackEvent('login_link_click')}
                className="text-sm font-semibold text-gray-600 hover:text-brand-pink transition-colors"
                rel="nofollow"
              >
                Ative sua IA do Instagram no WhatsApp
              </Link>
            )}
          </nav>
          <ButtonPrimary
            href="/register"
            onClick={() => trackEvent('cta_start_now_click')}
            className="px-4 py-2 text-sm sm:px-8 sm:py-4 sm:text-lg"
          >
            Começar Agora
          </ButtonPrimary>
          <button
            ref={menuButtonRef}
            className="md:hidden p-2 text-gray-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Menu"
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
        </div>
        {isMenuOpen && (
          <div className="absolute top-20 right-0 w-48 rounded-md bg-white shadow-lg md:hidden">
            <nav id="mobile-menu" className="flex flex-col p-2">
              {session ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setIsMenuOpen(false)}
                  ref={firstLinkRef}
                >
                  Meu Painel
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={() => {
                    trackEvent(showLoginButton ? 'login_button_click' : 'login_link_click');
                    setIsMenuOpen(false);
                  }}
                  className="px-4 py-2 text-sm hover:bg-gray-100"
                  ref={firstLinkRef}
                  rel="nofollow"
                >
                  Entrar
                </Link>
              )}
            </nav>
          </div>
        )}
      </Container>
    </header>
  );
}

