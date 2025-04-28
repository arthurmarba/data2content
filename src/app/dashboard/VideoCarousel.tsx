// src/app/dashboard/VideoCarousel.tsx
"use client";

import React from 'react';
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation'; // Mantém para as setas
import 'swiper/css/pagination'; // <<< NOVO: Importa CSS da paginação

// import required modules
import { Navigation, Pagination, A11y } from 'swiper/modules'; // <<< NOVO: Adiciona Pagination

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
  const enableLoop = videos.length > 1; // Loop com 1 slide visível precisa de 2+

  return (
    // Container principal: Removido padding horizontal, overflow hidden mantido
    <div className="relative video-carousel-container w-full overflow-hidden">
      <Swiper
        onSwiper={(swiper) => {
            if (swiperRef) {
                swiperRef.current = swiper;
            }
        }}
        modules={[Navigation, Pagination, A11y]} // <<< NOVO: Adicionado Pagination aos módulos
        // --- Configurações Mobile (Foco nas Setas) ---
        slidesPerView={1}
        spaceBetween={15}
        centeredSlides={false}
        loop={enableLoop}
        watchOverflow={true}
        // --- Fim Configurações Mobile ---
        navigation={{ // Lógica mantida, botões visíveis
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
        }}
        pagination={{ // <<< NOVO: Habilita paginação clicável
            clickable: true,
        }}
        grabCursor={true}
        className="mySwiper" // Classe para Swiper principal

        breakpoints={{
          // 640px (Tablets) - Mantém 2 slides
          640: {
            slidesPerView: 2,
            spaceBetween: 20,
            loop: enableLoop,
          },
          // 1024px (Desktops) - Mantém 3 slides
          1024: {
            slidesPerView: 3,
            spaceBetween: 30,
            loop: enableLoop,
          },
        }}
        a11y={{
            prevSlideMessage: 'Slide anterior',
            nextSlideMessage: 'Próximo slide',
            paginationBulletMessage: 'Ir para o slide {{index}}', // <<< NOVO: Mensagem para acessibilidade
        }}
      >
        {videos.map((video, index) => (
          <SwiperSlide key={video.id + '-' + index} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0 pb-8"> {/* <<< NOVO: Adicionado pb-8 para dar espaço à paginação */}
            {/* Container com aspect-ratio para manter proporção do vídeo */}
            <div className="aspect-video w-full bg-black">
              {/* Iframe preenche o container aspect-ratio */}
              <iframe
                className="w-full h-full" // Garante que preencha
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

      {/* Botões de Navegação Customizados - Mantidos */}
       <button className="swiper-button-prev-custom absolute top-1/2 left-2 transform -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-2.5 shadow-md transition-colors duration-200 ease-in-out disabled:opacity-30 disabled:cursor-not-allowed">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button className="swiper-button-next-custom absolute top-1/2 right-2 transform -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-2.5 shadow-md transition-colors duration-200 ease-in-out disabled:opacity-30 disabled:cursor-not-allowed">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Estilos Globais */}
      <style jsx global>{`
        .swiper-button-disabled {
          opacity: 0.3 !important;
          cursor: not-allowed !important;
        }

        /* Container principal: overflow hidden */
        .video-carousel-container {
             padding-left: 0;
             padding-right: 0;
             /* Adiciona padding inferior para garantir espaço para os pontos */
             padding-bottom: 10px;
        }

        /* Estilo dos slides */
        .mySwiper .swiper-slide {
           transition: none;
           opacity: 1;
           transform: none;
           height: auto;
           display: flex;
           flex-direction: column;
        }

        /* Swiper interno: overflow hidden */
        .mySwiper {
            width: 100%;
            overflow: hidden;
            padding: 0;
            margin: 0;
             /* Adiciona padding inferior para os pontos não ficarem colados */
             padding-bottom: 20px !important;
        }

        /* <<< NOVO: Estilização dos pontos de paginação >>> */
        .swiper-pagination {
            position: absolute; /* Posiciona relativo ao Swiper */
            bottom: 0px !important; /* Ajusta posição vertical (mais para baixo) */
            left: 0;
            width: 100%;
            text-align: center;
            z-index: 10; /* Garante que fiquem visíveis */
        }
        .swiper-pagination-bullet {
            width: 8px;
            height: 8px;
            background-color: #ccc; /* Cor padrão cinza claro */
            opacity: 0.7;
            border-radius: 50%;
            display: inline-block;
            margin: 0 4px; /* Espaçamento entre os pontos */
            cursor: pointer;
            transition: background-color 0.2s ease, opacity 0.2s ease;
        }
        .swiper-pagination-bullet-active {
            background-color: #E91E63; /* Cor brand-pink para o ponto ativo */
            opacity: 1;
        }

        /* --- Estilos para Telas Maiores (sm: 640px+) --- */
        @media (min-width: 640px) {
            /* Mantém botões visíveis */
            .swiper-button-prev-custom,
            .swiper-button-next-custom {
                display: block;
            }
             /* Ajusta posição dos botões */
             .swiper-button-prev-custom { left: 0.5rem; }
             .swiper-button-next-custom { right: 0.5rem; }

             .video-carousel-container {
                 padding-bottom: 0; /* Remove padding extra do container */
             }
             .mySwiper {
                 padding-bottom: 30px !important; /* Mantém espaço para paginação no desktop */
             }
        }

      `}</style>
    </div>
  );
}
