'use client';

import Link from 'next/link';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { motion, useScroll, useTransform, useMotionTemplate } from 'framer-motion';
import ButtonPrimary from './ButtonPrimary';
import Container from '../../components/Container';
import { track } from '@/lib/track';
import { MAIN_DASHBOARD_ROUTE } from '@/constants/routes';
import { getLandingPrimaryCtaLabel } from '@/app/landing/copy';

interface LandingHeaderProps {
  showLoginButton?: boolean;
  onCreatorCta?: () => void;
}

export default function LandingHeader({
  showLoginButton = false,
  onCreatorCta,
}: LandingHeaderProps) {
  const { data: session, status } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const ctaButtonRef = useRef<HTMLButtonElement>(null);
  const previousBodyOverflow = useRef<string | null>(null);
  const previousBodyTouchAction = useRef<string | null>(null);
  const isAuthenticated = Boolean(session?.user);
  const isSessionLoading = status === 'loading';
  const shouldShowLoginAction = showLoginButton && !isAuthenticated && !isSessionLoading;
  const primaryCtaLabel = getLandingPrimaryCtaLabel(isAuthenticated);

  const { scrollY } = useScroll();
  const headerBgOpacity = useTransform(scrollY, [0, 80], [0, 0.95]);
  const headerBlur = useTransform(scrollY, [0, 80], [0, 16]);
  const headerShadowOpacity = useTransform(scrollY, [0, 80], [0, 0.08]);
  const headerBorderOpacity = useTransform(scrollY, [0, 80], [0, 1]);

  const backgroundColor = useMotionTemplate`rgba(255, 255, 255, ${headerBgOpacity})`;
  const backdropFilter = useMotionTemplate`blur(${headerBlur}px)`;
  const boxShadow = useMotionTemplate`0 4px 24px rgba(15, 23, 42, ${headerShadowOpacity})`;
  const borderColor = useMotionTemplate`rgba(228, 232, 243, ${headerBorderOpacity})`;

  const handleJoinCommunity = () => {
    if (isSessionLoading) return;
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

  const handleOpenLogin = () => {
    track('landing_header_login_click');
    window.location.assign('/login');
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
      ctaButtonRef.current?.focus();
    } else {
      menuButtonRef.current?.focus();
    }
  }, [isMenuOpen, isAuthenticated, isSessionLoading, shouldShowLoginAction]);

  return (
    <motion.header
      className="fixed top-0 z-50 w-full border-b transition-[padding] duration-300 ease-out"
      style={{
        backgroundColor,
        backdropFilter,
        WebkitBackdropFilter: backdropFilter,
        boxShadow,
        borderColor,
        ...(isMounted
          ? {
            '--landing-header-extra': isScrolled ? '0px' : '8px',
          }
          : {}),
      } as any}
    >
      <Container className="relative z-[55] flex h-[3.1rem] items-center justify-between transition-all duration-300 ease-out md:h-[4.25rem]">
        <Link href="/" className="group flex items-center gap-1.5 text-[1.7rem] font-bold leading-none text-brand-dark md:gap-1.5 md:text-[1.85rem]">
          <div className="relative h-6.5 w-6.5 overflow-hidden md:h-[1.9rem] md:w-[1.9rem]">
            <Image
              src="/images/Colorido-Simbolo.png"
              alt="Data2Content"
              fill
              className="object-contain object-center group-hover:opacity-90 transition-opacity scale-[2.4]"
              priority
            />
          </div>
          <span className="text-[1.5rem] tracking-[-0.05em] md:text-[1.8rem]">data2content</span>
        </Link>
        <div className="flex items-center gap-3 md:gap-3.5">
          <nav className="hidden items-center gap-2 md:flex">
            <div className="flex items-center gap-2">
              {shouldShowLoginAction ? (
                <ButtonPrimary
                  onClick={handleOpenLogin}
                  size="sm"
                  variant="outline"
                  className="border-slate-200 bg-white px-[0.95rem] py-[0.6rem] text-[0.9rem] font-semibold text-brand-dark shadow-none hover:border-slate-300 hover:bg-slate-50"
                  magnetic={false}
                >
                  Login
                </ButtonPrimary>
              ) : null}
              {isAuthenticated ? (
                <ButtonPrimary
                  href={MAIN_DASHBOARD_ROUTE}
                  size="sm"
                  variant="brand"
                  className="px-[1.125rem] py-[0.6rem] text-[0.92rem] shadow-none"
                >
                  {primaryCtaLabel}
                </ButtonPrimary>
              ) : (
                <ButtonPrimary
                  onClick={handleJoinCommunity}
                  size="sm"
                  variant="brand"
                  className="px-[1.125rem] py-[0.6rem] text-[0.92rem] shadow-none"
                  disabled={isSessionLoading}
                >
                  {isSessionLoading ? 'Carregando...' : primaryCtaLabel}
                </ButtonPrimary>
              )}
            </div>
          </nav>

          <button
            ref={menuButtonRef}
            className="rounded-full border border-slate-200/70 bg-white/72 p-1.5 text-brand-dark shadow-[0_6px_14px_rgba(15,23,42,0.06)] md:hidden"
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
        <div className="fixed inset-x-4 top-[calc(var(--landing-header-h,4.5rem)+0.75rem)] z-[60] max-h-[calc(100vh-var(--landing-header-h,4.5rem)-1.5rem)] overflow-y-auto rounded-[1.65rem] border border-[#E7EBF6] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,251,255,0.98))] shadow-[0_18px_38px_rgba(15,23,42,0.12)] md:hidden">
          <nav id="mobile-menu" className="flex flex-col p-2.5">
            {shouldShowLoginAction ? (
              <ButtonPrimary
                onClick={() => {
                  setIsMenuOpen(false);
                  handleOpenLogin();
                }}
                className="mt-1 justify-start rounded-[1rem] border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-brand-dark shadow-none hover:border-slate-300 hover:bg-slate-50"
                size="sm"
                variant="outline"
                magnetic={false}
              >
                Login
              </ButtonPrimary>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (isSessionLoading) return;
                setIsMenuOpen(false);
                if (isAuthenticated) {
                  window.location.assign(MAIN_DASHBOARD_ROUTE);
                } else {
                  handleJoinCommunity();
                }
              }}
              className={[
                'mt-1 rounded-[1rem] bg-brand-primary px-4 py-3 text-left text-sm font-semibold text-white shadow-[0_12px_24px_rgba(245,43,106,0.18)] hover:bg-brand-primary-dark',
                isSessionLoading ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
              ref={isAuthenticated || isSessionLoading ? ctaButtonRef : undefined}
              disabled={isSessionLoading}
            >
              {isSessionLoading ? 'Carregando...' : primaryCtaLabel}
            </button>
          </nav>
        </div>
      )}

    </motion.header>
  );
}
