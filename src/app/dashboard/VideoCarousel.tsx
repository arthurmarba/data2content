// src/app/dashboard/VideoCarousel.tsx
"use client";

import React from 'react';
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation'; // Mantém para desktop

// import required modules
import { Navigation, A11y } from 'swiper/modules';

// Ícone para o placeholder
import { FaYoutube } from 'react-icons/fa';

// Interface para definir a estrutura de dados de cada vídeo
interface VideoData {
  id: string; // Identificador único para o vídeo/slide
  title: string; // Mantém no caso de precisar para o atributo title do iframe
  youtubeVideoId: string; // ID do vídeo do YouTube
}

// Props do componente VideoCarousel
interface VideoCarouselProps {
  videos: VideoData[];
  swiperRef?: React.MutableRefObject<any | null>; // Ref para controle externo
}

export default function VideoCarousel({ videos, swiperRef }: VideoCarouselProps) {
  if (!videos || videos.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">Nenhum guia em vídeo disponível no momento.</p>;
  }

  // Ajustar condição de loop
  const enableLoop = videos.length > 3; // Loop funciona melhor com mais slides que o visível

  return (
    // Container ajustado
    <div className="relative video-carousel-container">
      <Swiper
        onSwiper={(swiper) => {
            if (swiperRef) {
                swiperRef.current = swiper;
            }
        }}
        modules={[Navigation, A11y]}
        // --- Configurações Mobile (Correção Peek/Swipe v4) ---
        slidesPerView={1.3} // <<< MUDANÇA: Número decimal para forçar peek
        spaceBetween={15} // Espaço entre slides
        centeredSlides={false} // <<< MUDANÇA: Desativado
        loop={enableLoop}
        watchOverflow={true}
        // --- Fim Configurações Mobile ---
        navigation={{ // Mantém a lógica, botões escondidos no CSS mobile
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
        }}
        grabCursor={true} // Mantém o cursor de agarrar (importante para swipe)
        className="mySwiper" // Classe para Swiper principal

        breakpoints={{
          // 640px (Tablets) - Volta para números inteiros
          640: {
            slidesPerView: 2, // <<< MUDANÇA: Volta para inteiro
            spaceBetween: 20,
            centeredSlides: false,
            loop: enableLoop,
          },
          // 1024px (Desktops) - Volta para números inteiros
          1024: {
            slidesPerView: 3, // <<< MUDANÇA: Volta para inteiro
            spaceBetween: 30,
            centeredSlides: false,
            loop: enableLoop,
          },
        }}
        a11y={{
            prevSlideMessage: 'Slide anterior',
            nextSlideMessage: 'Próximo slide',
        }}
      >
        {videos.map((video, index) => (
          // *** REMOVIDO: Classe de largura w-[...] ***
          <SwiperSlide key={video.id + '-' + index} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
            {/* Container responsivo para o vídeo */}
            <div className="aspect-video w-full bg-black">
              {/* *** CORREÇÃO: URL do iframe corrigida *** */}
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${video.youtubeVideoId}?modestbranding=1&rel=0`} // URL Correta
                title={video.title} // Mantido para acessibilidade
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Botões de Navegação Customizados - Serão escondidos no mobile via CSS */}
       <button className="swiper-button-prev-custom absolute top-1/2 left-0 transform -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full p-2 shadow-md text-brand-dark hover:text-brand-pink transition-all disabled:opacity-30 disabled:cursor-not-allowed">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button className="swiper-button-next-custom absolute top-1/2 right-0 transform -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full p-2 shadow-md text-brand-dark hover:text-brand-pink transition-all disabled:opacity-30 disabled:cursor-not-allowed">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Estilos Globais */}
      <style jsx global>{`
        .swiper-button-disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        /* --- Estilo Mobile-First --- */

        /* Esconde botões por padrão (mobile) */
        .swiper-button-prev-custom,
        .swiper-button-next-custom {
            display: none;
        }

        /* Container principal: overflow hidden mantido */
        .video-carousel-container {
            overflow: hidden;
             /* Adiciona padding lateral para os slides não colarem nas bordas */
             padding-left: 16px;
             padding-right: 16px;
        }

        /* Estilo dos slides */
        .mySwiper .swiper-slide {
           transition: none;
           opacity: 1;
           transform: none;
           /* Garante que a altura seja calculada corretamente */
           height: auto;
        }

        /* Garante que o Swiper ocupe o espaço horizontal e permite overflow interno */
        .mySwiper {
            width: 100%;
            overflow: visible; /* Permite que slides "vazem" para o padding */
            padding: 0; /* Remove padding interno do Swiper */
            /* Adiciona margem negativa para compensar o padding do container, se necessário */
             margin-left: -16px;
             margin-right: -16px;
        }

        /* --- Estilos para Telas Maiores (sm: 640px+) --- */
        @media (min-width: 640px) {
            /* Mostra os botões novamente */
            .swiper-button-prev-custom,
            .swiper-button-next-custom {
                display: block;
            }

             /* Posiciona os botões fora do container */
            .video-carousel-container {
                overflow: visible; /* Permite botões fora */
                 padding-left: 0; /* Remove padding do container */
                 padding-right: 0; /* Remove padding do container */
            }
            .swiper-button-prev-custom { left: -1rem; }
            .swiper-button-next-custom { right: -1rem; }

            .mySwiper {
                 margin-left: 0; /* Remove margem negativa */
                 margin-right: 0; /* Remove margem negativa */
            }

             /* Estilos de slide para desktop */
              .mySwiper .swiper-slide {
                 opacity: 1;
                 transform: scale(1);
              }
        }

      `}</style>
    </div>
  );
}
