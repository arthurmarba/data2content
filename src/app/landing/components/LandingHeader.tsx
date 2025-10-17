'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import ButtonPrimary from './ButtonPrimary';
import Container from '../../components/Container';
import { track } from '@/lib/track';
import { MAIN_DASHBOARD_ROUTE } from '@/constants/routes';

interface LandingHeaderProps {
  showLoginButton?: boolean;
}

export default function LandingHeader({ showLoginButton = false }: LandingHeaderProps) {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const ctaButtonRef = useRef<HTMLButtonElement>(null);

  const navLinks = [
    { href: '#como-funciona', label: 'Como funciona' },
    { href: '#ranking', label: 'Ranking' },
    { href: '#categorias', label: 'Insights' },
    { href: '#beneficios', label: 'Benefícios' },
  ];

  const handleJoinCommunity = () => {
    track('cta_join_community_click');
    signIn('google', { callbackUrl: MAIN_DASHBOARD_ROUTE });
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      if (!session) {
        firstLinkRef.current?.focus();
      } else {
        ctaButtonRef.current?.focus();
      }
    } else {
      menuButtonRef.current?.focus();
    }
  }, [isMenuOpen, session]);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all ${
        isScrolled ? 'bg-white/95 shadow-lg backdrop-blur-md' : 'bg-white/75 backdrop-blur'
      }`}
    >
      <Container className="relative flex h-20 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2 text-2xl font-bold text-brand-dark">
          <div className="relative h-8 w-8 overflow-hidden">
            <Image
              src="/images/Colorido-Simbolo.png"
              alt="Data2Content"
              fill
              className="object-contain object-center group-hover:opacity-90 transition-opacity scale-[2.4]"
              priority
            />
          </div>
          <span>data2content</span>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-magenta"
              >
                {link.label}
              </a>
            ))}
            {session ? (
              <ButtonPrimary
                href={MAIN_DASHBOARD_ROUTE}
                className="px-4 py-2 text-sm"
              >
                Ir para o painel
              </ButtonPrimary>
            ) : (
              <ButtonPrimary
                onClick={handleJoinCommunity}
                className="px-4 py-2 text-sm"
              >
                Entrar na comunidade
              </ButtonPrimary>
            )}
          </nav>

          <button
            ref={menuButtonRef}
            className="p-2 text-gray-600 md:hidden"
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
              {navLinks.map((link, index) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsMenuOpen(false)}
                  ref={!session && index === 0 ? firstLinkRef : undefined}
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  if (session) {
                    window.location.assign(MAIN_DASHBOARD_ROUTE);
                  } else {
                    handleJoinCommunity();
                  }
                }}
                className="mt-1 rounded-md px-4 py-2 text-left text-sm font-semibold text-brand-magenta hover:bg-gray-100"
                ref={session ? ctaButtonRef : undefined}
              >
                {session ? 'Ir para o painel' : 'Entrar na comunidade'}
              </button>
            </nav>
          </div>
        )}
      </Container>
    </header>
  );
}
