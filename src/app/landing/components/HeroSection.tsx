'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import ButtonPrimary from './ButtonPrimary';
import { FaGoogle } from 'react-icons/fa';

export default function HeroSection() {
  const { scrollY } = useScroll();
  const topBlobY = useTransform(scrollY, [0, 500], [0, -100]);
  const bottomBlobY = useTransform(scrollY, [0, 500], [0, -150]);

  const trackEvent = (eventName: string) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName);
    }
  };

  const handleSignIn = () => {
    trackEvent('sign_in_click');
    signIn('google', { callbackUrl: '/auth/complete-signup' });
  };

  const heroVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: [0, 1],
      scale: [0.95, 1],
      transition: {
        ease: [0.33, 1, 0.68, 1],
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: [0, 1],
      y: 0,
      scale: [0.95, 1],
      transition: { duration: 0.7, ease: [0.33, 1, 0.68, 1] },
    },
  };

  return (
    <section className="snap-start relative flex flex-col h-screen pt-20 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 text-center overflow-x-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          style={{ y: topBlobY }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.35),transparent)]"
        />
        <motion.div
          style={{ y: bottomBlobY }}
          className="absolute bottom-20 right-0 w-72 h-72 bg-brand-pink/20 blur-3xl rounded-full"
        />
      </div>
      <div className="flex-grow flex flex-col justify-start pt-32">
        <div className="w-full">
          <motion.div
            variants={heroVariants}
            initial="hidden"
            animate="visible"
            className="w-full"
          >
            <div className="max-w-3xl mx-auto px-6 lg:px-8">
              <motion.h1
                variants={heroItemVariants}
                className="text-5xl md:text-7xl font-semibold tracking-tighter bg-gradient-to-r from-brand-pink to-brand-red bg-clip-text text-transparent"
              >
                A IA que diz o que postar no Instagram
              </motion.h1>

              <motion.p
                variants={heroItemVariants}
                className="mt-4 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto"
              >
                Receba análises e ideias prontas direto no WhatsApp.
              </motion.p>

              <motion.div variants={heroItemVariants}>
                <ButtonPrimary onClick={handleSignIn} className="mt-8">
                  <FaGoogle /> Ative sua IA do Instagram no WhatsApp ▸
                </ButtonPrimary>
              </motion.div>
              <motion.div variants={heroItemVariants}>
                <Link href="#features" onClick={() => trackEvent('saiba_mais_click')} className="mt-4 inline-block text-sm font-semibold text-brand-pink hover:underline">
                  Saiba Mais
                </Link>
              </motion.div>
            </div>

            <motion.div
              variants={heroItemVariants}
              className="relative mt-12 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50"
            >
              <video
                autoPlay
                muted
                loop
                playsInline
                poster="/images/tuca-analise-whatsapp.png"
                src="/videos/hero-demo.mp4"
                className="w-full max-w-4xl mx-auto rounded-2xl shadow-xl aspect-video"
                // CORREÇÃO: Removidos os atributos 'loading' e 'decoding' que não são válidos para a tag <video>.
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
