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
    // Container principal: Mantido com padding e overflow
    <div className="relative video-carousel-container w-full overflow-hidden px-4">
      <Swiper
        onSwiper={(swiper) => {
            if (swiperRef) {
                swiperRef.current = swiper;
            }
        }}
        modules={[Navigation, A11y]}
        // --- Configurações Mobile (Mantendo slidesPerView decimal) ---
        slidesPerView={1.25}
        spaceBetween={15}
        centeredSlides={false}
        loop={enableLoop}
        watchOverflow={true}
        // --- Fim Configurações Mobile ---
        navigation={{ // Mantém a lógica, botões escondidos no CSS mobile
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
        }}
        grabCursor={true} // Mantém o cursor de agarrar
        className="mySwiper" // Classe para Swiper principal
        // Adiciona configuração para tentar melhorar detecção de swipe
        touchStartPreventDefault={false} // Tenta não prevenir o default do touchstart
        touchStartForcePreventDefault={false}

        breakpoints={{
          // 640px (Tablets) - Volta para números inteiros
          640: {
            slidesPerView: 2,
            spaceBetween: 20,
            loop: enableLoop,
          },
          // 1024px (Desktops) - Volta para números inteiros
          1024: {
            slidesPerView: 3,
            spaceBetween: 30,
            loop: enableLoop,
          },
        }}
        a11y={{
            prevSlideMessage: 'Slide anterior',
            nextSlideMessage: 'Próximo slide',
        }}
      >
        {videos.map((video, index) => (
          <SwiperSlide key={video.id + '-' + index} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
            {/* Container relativo para posicionar o overlay */}
            <div className="relative aspect-video w-full bg-black">
              <iframe
                className="absolute top-0 left-0 w-full h-full" // Posiciona o iframe para preencher
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${video.youtubeVideoId}?modestbranding=1&rel=0`} // URL Correta
                title={video.title} // Mantido para acessibilidade
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              ></iframe>
              {/* *** NOVO: Overlay transparente sobre o iframe *** */}
              <div className="absolute top-0 left-0 w-full h-full z-10"></div> {/* Este div captura o swipe */}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Botões de Navegação Customizados - Serão escondidos no mobile via CSS */}
       <button className="swiper-button-prev-custom absolute top-1/2 left-2 transform -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-2 shadow-md text-brand-dark hover:text-brand-pink transition-all disabled:opacity-30 disabled:cursor-not-allowed"> {/* Aumentado z-index */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button className="swiper-button-next-custom absolute top-1/2 right-2 transform -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-2 shadow-md text-brand-dark hover:text-brand-pink transition-all disabled:opacity-30 disabled:cursor-not-allowed"> {/* Aumentado z-index */}
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

        /* Container principal: Garante overflow hidden e tem padding */
        .video-carousel-container {
            /* w-full já aplicado via Tailwind */
            /* overflow-hidden já aplicado via Tailwind */
            /* px-4 já aplicado via Tailwind */
        }

        /* Estilo dos slides */
        .mySwiper .swiper-slide {
           transition: none;
           opacity: 1;
           transform: none;
           height: auto; /* Garante altura correta */
        }

        /* Swiper interno: permite overflow para "vazar" no padding do container */
        .mySwiper {
            width: 100%;
            overflow: visible; /* Permite vazar no padding */
            padding: 0;
            margin: 0;
            /* Remove touch-action e outras propriedades que podem interferir */
             /* -webkit-overflow-scrolling: touch; */
             /* touch-action: pan-y pinch-zoom; */
             /* user-select: none; */
             /* -webkit-user-drag: none; */
        }

        /* --- Estilos para Telas Maiores (sm: 640px+) --- */
        @media (min-width: 640px) {
            /* Mostra os botões novamente */
            .swiper-button-prev-custom,
            .swiper-button-next-custom {
                display: block;
            }

             /* Posiciona os botões DENTRO do container */
            .video-carousel-container {
                overflow: hidden; /* Mantém hidden para conter os botões */
                padding-left: 0; /* Remove padding no desktop */
                padding-right: 0; /* Remove padding no desktop */
            }
            /* Ajusta posição dos botões */
            .swiper-button-prev-custom { left: 0.5rem; }
            .swiper-button-next-custom { right: 0.5rem; }

            .mySwiper {
                 overflow: hidden; /* Esconde overflow no desktop */
                 /* touch-action: auto; */ /* Restaura padrão se necessário */
            }

             /* Estilos de slide para desktop */
              .mySwiper .swiper-slide {
                 opacity: 1;
                 transform: scale(1);
              }

             /* Remove o overlay em telas maiores onde o swipe não é o principal */
             .mySwiper .swiper-slide .absolute.z-10 {
                /* display: none; */ /* Descomente se o overlay atrapalhar o clique no player no desktop */
             }
        }

      `}</style>
    </div>
  );
}
