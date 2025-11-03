'use client';
import { motion } from 'framer-motion';
// import { FaGoogle } from 'react-icons/fa'; // Ícone removido, então a importação não é mais necessária
import { signIn } from 'next-auth/react';
import { MAIN_DASHBOARD_ROUTE } from '@/constants/routes';
import ButtonPrimary from './ButtonPrimary';
import TypingEffect from './TypingEffect';
import Marquee from './Marquee';
import heroQuestions from '@/data/heroQuestions';
import heroAnswers from '@/data/heroAnswers';

const YOUTUBE_VIDEO_ID = 'NN0_0zxwx0E';

export default function HeroSection() {
  const handleSignIn = () => {
    signIn('google', { callbackUrl: MAIN_DASHBOARD_ROUTE });
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

  const youtubeEmbedUrl = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?controls=1&rel=0&showinfo=0&modestbranding=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}`;

  return (
    <section className="relative overflow-x-hidden bg-gray-100 py-20 text-center text-brand-dark md:py-24">
      <div className="w-full">
        <motion.div variants={heroVariants} initial="hidden" animate="visible" className="w-full">
          <div className="max-w-3xl mx-auto px-6 lg:px-8">
            <motion.h1
              variants={heroItemVariants}
              className="text-[2.5rem] font-semibold leading-tight tracking-tight sm:text-[3rem] md:text-[3.5rem] lg:text-[4rem]"
            >
              Milhares de posts virais do Instagram, decifrados pelo ChatGPT.
            </motion.h1>

            {/*
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
            */}

            {/* A margem superior foi aumentada de mt-8 para mt-12 para criar mais espaço */}
            <motion.div variants={heroItemVariants} className="mt-10 md:mt-12">
              {/* O ícone do Google foi removido para testar o layout do texto */}
              <ButtonPrimary onClick={handleSignIn}>
                Experimente Grátis
              </ButtonPrimary>
            </motion.div>
          </div>
          
          <motion.div variants={heroItemVariants} className="mt-10 md:mt-12 w-full space-y-4">
            {/* Perguntas/Pedidos (cinza) */}
            <Marquee
              items={heroQuestions}
              direction="left"
              itemClassName="flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-800 border border-gray-200 shadow-sm"
            />
            {/* Respostas/Insights (branco) */}
            <Marquee
              items={heroAnswers}
              direction="right"
              itemClassName="flex-shrink-0 whitespace-nowrap px-5 py-2.5 rounded-2xl bg-white text-gray-900 border border-gray-200 shadow-sm"
            />
          </motion.div>

          {/* Vídeo ocultado temporariamente */}
          {/**
          <motion.div variants={heroItemVariants} className="mt-12 px-6">
            <div className="relative max-w-3xl mx-auto w-full rounded-lg overflow-hidden shadow-lg aspect-w-16 aspect-h-9">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={youtubeEmbedUrl}
                title="Demo do data2content"
                frameBorder="0"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </motion.div>
          */}
        </motion.div>
      </div>
    </section>
  );
}
