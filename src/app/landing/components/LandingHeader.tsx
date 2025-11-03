'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
  const [isMounted, setIsMounted] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const ctaButtonRef = useRef<HTMLButtonElement>(null);

  const navLinks = [
    { href: '#galeria', label: 'Criadores' },
    { href: '#impacto', label: 'Impacto' },
    { href: '#ecossistema', label: 'Ecossistema' },
    { href: '#planos', label: 'Planos' },
    { href: '#marcas', label: 'Marcas' },
  ];

  const handleJoinCommunity = () => {
    track('landing_header_creator_cta_click');
    window.location.assign('/signup');
  };

  const handleBrands = () => {
    track('landing_header_brand_cta_click');
    window.location.assign('/campaigns/new?utm_source=landing&utm_medium=header&utm_campaign=multi_creator');
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMounted(true);
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
      className={[
        'fixed top-0 z-50 w-full border-b transition-all duration-300 ease-out backdrop-blur',
        isScrolled ? 'border-[#E4E8F3] bg-white/95 shadow-[0_4px_24px_rgba(15,23,42,0.08)]' : 'border-transparent bg-white/75',
      ].join(' ')}
      style={
        isMounted
          ? ({
              '--landing-header-extra': isScrolled ? '0px' : '8px',
            } as CSSProperties)
          : undefined
      }
    >
      <Container className="relative flex h-16 items-center justify-between transition-all duration-300 ease-out md:h-[4.5rem]">
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
                className="text-sm font-medium text-brand-text-secondary transition-colors hover:text-brand-dark"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={handleBrands}
              className="text-sm font-semibold text-brand-dark/70 transition-colors hover:text-brand-dark"
            >
              Sou marca
            </button>
            {session ? (
              <ButtonPrimary href={MAIN_DASHBOARD_ROUTE} size="sm" variant="outline" className="shadow-none">
                Ir para o painel
              </ButtonPrimary>
            ) : (
              <ButtonPrimary onClick={handleJoinCommunity} size="sm" variant="solid">
                Criar conta gratuita
              </ButtonPrimary>
            )}
          </nav>

          <button
            ref={menuButtonRef}
            className="p-2 text-brand-dark md:hidden"
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
          <div className="absolute top-20 right-0 w-full rounded-2xl border border-[#E7EBF6] bg-white/95 shadow-[0_18px_38px_rgba(15,23,42,0.12)] md:hidden">
            <nav id="mobile-menu" className="flex flex-col p-2">
              {navLinks.map((link, index) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-brand-dark/80 hover:bg-brand-light"
                  onClick={() => setIsMenuOpen(false)}
                  ref={!session && index === 0 ? firstLinkRef : undefined}
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => {
                  handleBrands();
                  setIsMenuOpen(false);
                }}
                className="mt-1 rounded-xl px-4 py-3 text-left text-sm font-semibold text-brand-dark hover:bg-brand-light"
              >
                Sou marca
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  if (session) {
                    window.location.assign(MAIN_DASHBOARD_ROUTE);
                  } else {
                    handleJoinCommunity();
                  }
                }}
                className="mt-1 rounded-xl px-4 py-3 text-left text-sm font-semibold text-brand-dark hover:bg-brand-light"
                ref={session ? ctaButtonRef : undefined}
              >
                {session ? 'Ir para o painel' : 'Criar conta gratuita'}
              </button>
            </nav>
          </div>
        )}
      </Container>
    </header>
  );
}
