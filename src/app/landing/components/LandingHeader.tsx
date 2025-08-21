'use client';

import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import ButtonPrimary from './ButtonPrimary';
import Container from '../../components/Container';
import { track } from '@/lib/track';

interface LandingHeaderProps {
  showLoginButton?: boolean;
}

export default function LandingHeader({ showLoginButton = false }: LandingHeaderProps) {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const handleSignIn = () => {
    track('login_button_click');
    signIn('google', { callbackUrl: '/auth/complete-signup' });
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
        <div className="flex items-center gap-5">
          <nav className="hidden md:flex items-center gap-5">
            {session ? (
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-gray-600 hover:text-brand-pink transition-colors"
              >
                Meu Painel
              </Link>
            ) : (
              // CORREÇÃO: Simplificado para um único link de Login
              <button
                onClick={handleSignIn}
                className="text-sm font-semibold text-gray-600 hover:text-brand-pink transition-colors"
              >
                Login
              </button>
            )}
            {/* Mantido o botão principal de "Começar Agora" */}
            <ButtonPrimary
              onClick={() => {
                track('cta_start_now_click');
                handleSignIn();
              }}
              className="px-4 py-2 text-sm" // Ajustado para um tamanho menor
            >
              Começar Agora
            </ButtonPrimary>
          </nav>
          
          <button
            ref={menuButtonRef}
            className="md:hidden p-2 text-gray-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Menu"
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <XMarkIcon className="w-6 h-6" aria-hidden="true" />
            ) : (
              <Bars3Icon className="w-6 h-6" aria-hidden="true" />
            )}
          </button>
        </div>
        {isMenuOpen && (
          <div className="absolute top-20 right-0 w-full rounded-md bg-white shadow-lg md:hidden">
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
                <>
                  <Link
                    href="/login"
                    onClick={() => {
                      track('login_link_click');
                      setIsMenuOpen(false);
                    }}
                    className="px-4 py-2 text-sm hover:bg-gray-100"
                    ref={firstLinkRef}
                    rel="nofollow"
                  >
                    Login
                  </Link>
                  <button
                    onClick={() => {
                      track('cta_start_now_click');
                      setIsMenuOpen(false);
                      handleSignIn();
                    }}
                    className="px-4 py-2 text-sm font-bold text-brand-pink hover:bg-gray-100 text-left"
                  >
                    Começar Agora
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </Container>
    </header>
  );
}
