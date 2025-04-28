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

  // Ajustar condição de loop para centeredSlides
  const enableLoop = videos.length > 1; // Com centeredSlides, loop pode funcionar com 2+

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
        // --- Configurações Mobile (Estilo Netflix - Tentativa 3) ---
        slidesPerView={'auto'} // Essencial para peek view
        spaceBetween={12} // Espaço reduzido entre slides
        centeredSlides={true} // <<< REATIVADO: Centraliza o slide ativo
        loop={enableLoop}
        watchOverflow={true} // Ajuda Swiper a detectar se não há slides suficientes para scroll/loop
        // --- Fim Configurações Mobile ---
        navigation={{ // Mantém a lógica, botões escondidos no CSS mobile
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
        }}
        grabCursor={true} // Mantém o cursor de agarrar (importante para swipe)
        className="mySwiper" // Classe para Swiper principal
        // REMOVIDO: slidesOffsetBefore/After

        breakpoints={{
          // 640px (Tablets) - Configuração anterior mantida (sem centralizar)
          640: {
            slidesPerView: 2,
            spaceBetween: 20,
            centeredSlides: false, // Mantém desativado para telas maiores
            loop: enableLoop,
          },
          // 1024px (Desktops) - Configuração anterior mantida (sem centralizar)
          1024: {
            slidesPerView: 3,
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
          // *** AJUSTADO: w-[65%] para garantir peek com centralização ***
          <SwiperSlide key={video.id + '-' + index} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm w-[65%] sm:w-[calc(50%-10px)] lg:w-[calc(33.33%-20px)] flex-shrink-0">
            {/* Container responsivo para o vídeo */}
            <div className="aspect-video w-full bg-black">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${video.youtubeVideoId}?modestbranding=1&rel=0`}
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
        }

        /* Simplifica estilo dos slides no mobile */
        .mySwiper .swiper-slide {
           transition: none;
           opacity: 1;
           transform: none;
           /* Adiciona um filtro leve nos slides não centrados para dar destaque ao ativo */
           /* filter: brightness(0.9); */ /* Descomente se quiser um leve escurecimento */
        }
        /* Estilo para o slide ativo (centralizado) */
         .mySwiper .swiper-slide-active {
             /* filter: brightness(1); */ /* Garante brilho normal */
             /* Poderia adicionar uma leve escala aqui se quisesse */
             /* transform: scale(1.02); */
             z-index: 1; /* Garante que fique na frente */
         }


        /* Garante que o Swiper ocupe o espaço horizontal e permite overflow interno */
        .mySwiper {
            width: 100%;
            overflow: visible; /* Permite que slides "vazem" */
            padding: 0;
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
            }
            .swiper-button-prev-custom { left: -1rem; }
            .swiper-button-next-custom { right: -1rem; }

             /* Estilos de slide para desktop */
              .mySwiper .swiper-slide {
                 opacity: 1;
                 transform: scale(1);
                 filter: none; /* Remove filtro de brilho */
                 /* transition: transform 0.3s ease, opacity 0.3s ease; */
              }
        }

      `}</style>
    </div>
  );
}
