// src/app/dashboard/VideoCarousel.tsx
"use client";

import React from 'react';
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-coverflow'; // Import coverflow effect if needed for centering emphasis

// import required modules
import { Navigation, Pagination, A11y } from 'swiper/modules'; // Added A11y for accessibility

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

  // Garante que haja vídeos suficientes para o loop funcionar corretamente
  const enableLoop = videos.length > 2;

  return (
    <div className="relative video-carousel-container"> {/* Container para posicionar botões */}
      <Swiper
        // Passa a ref para controle externo, se fornecida
        onSwiper={(swiper) => {
            if (swiperRef) {
                swiperRef.current = swiper;
            }
        }}
        modules={[Navigation, Pagination, A11y]} // Habilita módulos
        // --- Configurações para Mobile (com Peek) ---
        slidesPerView={'auto'} // Mostra quantos slides couberem, permitindo peek
        spaceBetween={15} // Espaço entre os slides (ajuste fino)
        centeredSlides={true} // Centraliza o slide ativo
        loop={enableLoop} // Habilita loop infinito se houver vídeos suficientes
        // --- Fim Configurações Mobile ---
        navigation={{ // Configuração dos botões de navegação
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
        }}
        pagination={{ clickable: true }} // Adiciona paginação clicável (pontos)
        grabCursor={true} // Mostra cursor de "agarrar"
        className="mySwiper" // Classe para estilização customizada
        // Breakpoints para responsividade (mantém como antes para telas maiores)
        breakpoints={{
          // Quando a largura da tela for >= 640px (tablets)
          640: {
            slidesPerView: 2, // Volta a mostrar 2 slides completos
            spaceBetween: 20,
            centeredSlides: false, // Desativa centralização em telas maiores se preferir
            loop: enableLoop, // Mantém loop se ativado
          },
          // Quando a largura da tela for >= 1024px (desktops)
          1024: {
            slidesPerView: 3, // Mostra 3 slides completos
            spaceBetween: 30,
            centeredSlides: false, // Desativa centralização
            loop: enableLoop, // Mantém loop se ativado
          },
        }}
        // Adiciona atributos de acessibilidade
        a11y={{
            prevSlideMessage: 'Slide anterior',
            nextSlideMessage: 'Próximo slide',
            paginationBulletMessage: 'Ir para o slide {{index}}',
        }}
      >
        {videos.map((video, index) => (
          // Adiciona uma classe de largura para o 'auto' funcionar bem
          // REMOVIDO pb-4 (padding-bottom) para ajustar após remoção do título
          <SwiperSlide key={video.id + '-' + index} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm w-[85%] sm:w-[calc(50%-10px)] lg:w-[calc(33.33%-20px)] flex-shrink-0">
            {/* Container responsivo para o vídeo */}
            <div className="aspect-video w-full bg-black">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${video.youtubeVideoId}?modestbranding=1&rel=0`}
                // O title do iframe ainda é útil para acessibilidade
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
            {/* Título do vídeo abaixo REMOVIDO */}
            {/*
            <h4 className="text-sm font-semibold text-brand-dark px-3 pt-3 truncate">
              {video.title}
            </h4>
            */}
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Botões de Navegação Customizados (mantidos) */}
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

      {/* Estilos Globais (mantidos e ajustados) */}
      <style jsx global>{`
        .swiper-button-disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .swiper-pagination-bullet {
            background-color: #ccc;
            opacity: 0.7;
            transition: background-color 0.2s ease; /* Suaviza a transição da cor */
        }
        .swiper-pagination-bullet-active {
            background-color: #E91E63; /* Cor brand-pink */
            opacity: 1;
        }
        /* Ajuste para centralização e peek view */
        .mySwiper .swiper-slide {
          transition: transform 0.3s ease, opacity 0.3s ease; /* Adiciona transição suave */
          opacity: 0.6; /* Deixa slides não ativos levemente transparentes */
          transform: scale(0.9); /* Deixa slides não ativos levemente menores */
        }
        .mySwiper .swiper-slide-active {
           opacity: 1; /* Slide ativo totalmente opaco */
           transform: scale(1); /* Slide ativo no tamanho normal */
           z-index: 1; /* Garante que o slide ativo fique na frente */
        }

        /* Ajusta o padding do container para os botões não sobreporem o conteúdo em telas pequenas */
        .video-carousel-container {
            padding-left: 2.5rem; /* Mais espaço para botão prev */
            padding-right: 2.5rem; /* Mais espaço para botão next */
            overflow: hidden; /* Evita que slides "vazem" visualmente do container */
        }
         /* Remove padding extra dos botões em telas maiores onde eles ficam fora */
        @media (min-width: 768px) {
            .video-carousel-container {
                padding-left: 0;
                padding-right: 0;
                overflow: visible; /* Permite que os botões fiquem fora */
            }
            .swiper-button-prev-custom { left: -1rem; } /* Posição ajustada para fora */
            .swiper-button-next-custom { right: -1rem; } /* Posição ajustada para fora */

             /* Remove efeitos de escala/opacidade em telas maiores se não quiser */
             .mySwiper .swiper-slide {
                opacity: 1;
                transform: scale(1);
             }
        }

        /* Garante que o Swiper ocupe o espaço horizontal */
        .mySwiper {
            width: 100%;
            padding-bottom: 30px; /* Espaço para a paginação (pontos) */
        }

      `}</style>
    </div>
  );
}

