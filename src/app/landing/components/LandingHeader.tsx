'use client';

import Link from 'next/link';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import ButtonPrimary from './ButtonPrimary';
import Container from '../../components/Container';
import { track } from '@/lib/track';
import { MAIN_DASHBOARD_ROUTE } from '@/constants/routes';
import { useUtmAttribution } from '@/hooks/useUtmAttribution';
import type { UtmContext } from '@/lib/analytics/utm';

interface LandingHeaderProps {
  showLoginButton?: boolean;
  onCreatorCta?: () => void;
}

export default function LandingHeader({ showLoginButton = false, onCreatorCta }: LandingHeaderProps) {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const ctaButtonRef = useRef<HTMLButtonElement>(null);
  const previousBodyOverflow = useRef<string | null>(null);
  const previousBodyTouchAction = useRef<string | null>(null);
  const { appendUtm, utm } = useUtmAttribution();

  const navLinks = [
    { href: '#impacto', label: 'Impacto' },
    { href: '#galeria', label: 'Criadores' },
    { href: '#ecossistema', label: 'Ecossistema' },
    { href: '#planos', label: 'Planos' },
    { href: '#marcas', label: 'Marcas' },
  ];

  const handleJoinCommunity = () => {
    track('landing_header_creator_cta_click');

    if (onCreatorCta) {
      onCreatorCta();
      return;
    }

    const fallbackToLogin = () => window.location.assign('/login');

    signIn('google', { callbackUrl: MAIN_DASHBOARD_ROUTE })
      .then((result) => {
        if (result?.error) {
          fallbackToLogin();
        }
      })
      .catch(fallbackToLogin);
  };

  const handleBrands = () => {
    track('landing_header_brand_cta_click');
    const overrides: Partial<UtmContext> = {
      utm_content: 'landing_header_brand_button',
    };
    if (!utm.utm_source) overrides.utm_source = 'landing';
    if (!utm.utm_medium) overrides.utm_medium = 'header_cta';
    if (!utm.utm_campaign) overrides.utm_campaign = 'multi_creator';
    const destination = appendUtm('/campaigns/new', overrides) || '/campaigns/new';
    window.location.assign(destination);
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
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = () => {
      if (mq.matches) setIsMenuOpen(false);
    };
    handleChange();
    mq.addEventListener?.('change', handleChange);
    return () => mq.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;

    if (previousBodyOverflow.current === null) {
      previousBodyOverflow.current = body.style.overflow;
    }
    if (previousBodyTouchAction.current === null) {
      previousBodyTouchAction.current = body.style.touchAction;
    }

    if (isMenuOpen) {
      body.style.overflow = 'hidden';
      body.style.touchAction = 'none';
    } else {
      body.style.overflow = previousBodyOverflow.current || '';
      body.style.touchAction = previousBodyTouchAction.current || '';
    }

    return () => {
      body.style.overflow = previousBodyOverflow.current || '';
      body.style.touchAction = previousBodyTouchAction.current || '';
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

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
        isScrolled
          ? 'border-[#E4E8F3] bg-white/95 shadow-[0_4px_24px_rgba(15,23,42,0.08)]'
          : 'border-transparent bg-white/80',
      ].join(' ')}
      style={
        isMounted
          ? ({
              '--landing-header-extra': isScrolled ? '0px' : '8px',
            } as CSSProperties)
          : undefined
      }
    >
      <Container className="relative z-[55] flex h-16 items-center justify-between transition-all duration-300 ease-out md:h-[4.5rem]">
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
                className="text-sm font-medium text-brand-text-secondary/80 transition-colors hover:text-brand-dark"
              >
                {link.label}
              </a>
            ))}
            <ButtonPrimary
              onClick={handleBrands}
              size="sm"
              variant="outline"
              className="shadow-none"
            >
              Sou marca
            </ButtonPrimary>
            {session ? (
              <ButtonPrimary href={MAIN_DASHBOARD_ROUTE} size="sm" variant="brand" className="shadow-none">
                Ir para o painel
              </ButtonPrimary>
            ) : (
              <ButtonPrimary onClick={handleJoinCommunity} size="sm" variant="brand">
                Criar conta gratuita
              </ButtonPrimary>
            )}
          </nav>

          <button
            ref={menuButtonRef}
            className="p-2 text-brand-dark md:hidden"
            onClick={() => setIsMenuOpen((prev) => !prev)}
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
      </Container>
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px] md:hidden"
          aria-hidden="true"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
      {isMenuOpen && (
        <div className="fixed inset-x-4 top-[calc(var(--landing-header-h,4.5rem)+0.75rem)] z-[60] max-h-[calc(100vh-var(--landing-header-h,4.5rem)-1.5rem)] overflow-y-auto rounded-2xl border border-[#E7EBF6] bg-white/95 shadow-[0_18px_38px_rgba(15,23,42,0.12)] md:hidden">
          <nav id="mobile-menu" className="flex flex-col p-2">
            {navLinks.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-xl px-4 py-3 text-sm font-medium text-brand-text-secondary/90 hover:bg-brand-light"
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
              className="mt-1 rounded-xl border border-brand-primary/40 px-4 py-3 text-left text-sm font-semibold text-brand-primary hover:bg-brand-primary/10"
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
    </header>
  );
}
