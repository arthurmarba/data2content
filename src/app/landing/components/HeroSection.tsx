'use client';
import { motion } from 'framer-motion';
import { FaGoogle } from 'react-icons/fa';
import { signIn } from 'next-auth/react';
import ButtonPrimary from './ButtonPrimary';
import TypingEffect from './TypingEffect';
import Marquee from './Marquee';
import heroQuestions from '@/data/heroQuestions';

export default function HeroSection() {
  const handleSignIn = () => {
    signIn('google', { callbackUrl: '/auth/complete-signup' });
  };

  const heroVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.1 },
    },
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section className="relative flex flex-col min-h-[90vh] bg-gray-100 text-center overflow-x-hidden pt-20 pb-10">
      <div className="flex-grow flex flex-col justify-center">
        <div className="w-full">
          <motion.div variants={heroVariants} initial="hidden" animate="visible" className="w-full">
            <div className="max-w-3xl mx-auto px-6 lg:px-8">
              <motion.h1
                variants={heroItemVariants}
                className="text-5xl md:text-7xl font-extrabold tracking-tighter text-brand-dark"
              >
                O fim da dúvida: o que postar hoje?
              </motion.h1>

              <motion.div variants={heroItemVariants} className="mt-6 h-14 md:h-auto">
                <TypingEffect
                  sequence={[
                    'Uma Inteligência Artificial.',
                    1000,
                    'Uma Inteligência Artificial conectada ao seu Instagram.',
                    1000,
                    'Uma Inteligência Artificial para conversar no WhatsApp.',
                    3000,
                  ]}
                  className="text-lg md:text-xl text-gray-600 max-w-2xl leading-relaxed mx-auto"
                />
              </motion.div>

              <motion.div variants={heroItemVariants}>
                <ButtonPrimary onClick={handleSignIn} className="mt-8">
                  <FaGoogle /> Ative sua IA do Instagram no WhatsApp ▸
                </ButtonPrimary>
              </motion.div>
            </div>

            <motion.div variants={heroItemVariants} className="mt-10 md:mt-12 w-full space-y-4">
              <Marquee items={heroQuestions} direction="left" />
              <Marquee items={[...heroQuestions].reverse()} direction="right" />
            </motion.div>

            {/* VÍDEO DO YOUTUBE ADICIONADO AQUI */}
            <motion.div variants={heroItemVariants} className="mt-12 px-6">
              <div className="relative max-w-4xl mx-auto aspect-video rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/n5E_hLThxEA" // <-- TROQUE O ID DO VÍDEO AQUI
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </motion.div>
            
          </motion.div>
        </div>
      </div>
    </section>
  );
}
