'use client';
import { motion } from 'framer-motion';
import { FaGoogle } from 'react-icons/fa';
import { signIn } from 'next-auth/react';
import ButtonPrimary from './ButtonPrimary';
import TypingEffect from './TypingEffect';
import Marquee from './Marquee';
import heroQuestions from '@/data/heroQuestions';

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

  // URL otimizada para autoplay, sem controlos e em loop
  const youtubeEmbedUrl = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&controls=0&autohide=1&rel=0&showinfo=0&modestbranding=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}`;

  return (
    // O espaçamento no topo foi reduzido de pt-32 para pt-20
    <section className="relative bg-gray-100 text-center overflow-x-hidden pt-20 pb-24">
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
                  'Uma Inteligência Artificial do seu Instagram.',
                  1000,
                  'Uma Inteligência Artificial no seu WhatsApp.',
                  3000,
                ]}
                className="text-lg md:text-xl text-gray-600 max-w-2xl leading-relaxed mx-auto"
              />
            </motion.div>

            <motion.div variants={heroItemVariants}>
              {/* O espaçamento foi reduzido de mt-6 para mt-4 */}
              <ButtonPrimary onClick={handleSignIn} className="mt-4">
                <FaGoogle /> Ative IA do Instagram no WhatsApp ▸
              </ButtonPrimary>
            </motion.div>
          </div>

          <motion.div variants={heroItemVariants} className="mt-10 md:mt-12 w-full space-y-4">
            <Marquee items={heroQuestions} direction="left" />
            <Marquee items={[...heroQuestions].reverse()} direction="right" />
          </motion.div>

          <motion.div variants={heroItemVariants} className="mt-12 px-6">
            <div
              className="relative max-w-3xl mx-auto w-full rounded-lg overflow-hidden shadow-lg"
              style={{
                paddingTop: '56.25%', // Define um contêiner padrão 16:9
                overflow: 'hidden',   // Essencial para cortar o excesso
              }}
            >
              <iframe
                className="absolute left-0" // Removido top-0 para controle via style
                style={{
                  position: 'absolute',
                  top: '0', // Alinha o vídeo pelo topo
                  left: '50%',
                  width: '100%',
                  height: '100%',
                  // Alinha horizontalmente e aplica zoom, sem mover verticalmente
                  transform: 'translateX(-50%) scale(1.5)',
                }}
                src={youtubeEmbedUrl}
                title="Demo do data2content"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
              {/* Esta div transparente fica sobre o iframe para capturar os cliques */}
              <div className="absolute top-0 left-0 w-full h-full"></div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
