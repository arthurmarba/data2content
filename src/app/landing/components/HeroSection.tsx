'use client';
import { motion } from 'framer-motion';
import { FaGoogle } from 'react-icons/fa';
import { signIn } from 'next-auth/react';
import ButtonPrimary from './ButtonPrimary';
import TypingEffect from './TypingEffect';
import Marquee from './Marquee';
import heroQuestions from '@/data/heroQuestions';

// CORREÇÃO: O ID do vídeo foi atualizado para o novo link.
const YOUTUBE_VIDEO_ID = '0Uu_VJeVVfo';

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

  // URL do YouTube otimizada para a aparência mais limpa, sem loop para evitar a barra de playlist.
  const youtubeEmbedUrl = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&controls=0&rel=0&showinfo=0&modestbranding=1`;

  return (
    <section className="relative bg-gray-100 text-center overflow-x-hidden pt-32 pb-24">
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

          <motion.div variants={heroItemVariants} className="mt-12 px-6">
            <div
              className="relative max-w-2xl mx-auto w-full rounded-lg overflow-hidden shadow-lg"
              style={{ paddingTop: '56.25%' }} // Proporção 16:9
            >
              <iframe
                className="absolute top-0 left-0 h-full w-full"
                src={youtubeEmbedUrl}
                title="Demo do data2content"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
              {/* Esta div transparente fica sobre o iframe para capturar os cliques do mouse e impedir que os controles do YouTube apareçam */}
              <div className="absolute top-0 left-0 w-full h-full"></div>
            </div>
          </motion.div>
          
        </motion.div>
      </div>
    </section>
  );
}
