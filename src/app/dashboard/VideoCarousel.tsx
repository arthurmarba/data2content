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
    // Container principal: Adicionado w-full e overflow-hidden para desktop
    <div className="relative video-carousel-container w-full overflow-hidden">
      <Swiper
        onSwiper={(swiper) => {
            if (swiperRef) {
                swiperRef.current = swiper;
            }
        }}
        modules={[Navigation, A11y]}
        // --- Configurações Mobile (Correção Peek/Swipe v5) ---
        slidesPerView={'auto'} // <<< VOLTOU para 'auto'
        spaceBetween={12} // Espaço entre slides (ajuste se necessário)
        centeredSlides={false} // Mantém desativado
        loop={enableLoop}
        watchOverflow={true}
        // --- Fim Configurações Mobile ---
        navigation={{ // Mantém a lógica, botões escondidos no CSS mobile
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
        }}
        grabCursor={true} // Mantém o cursor de agarrar (importante para swipe)
        className="mySwiper" // Classe para Swiper principal
        // Adiciona padding inicial/final para criar espaço nas bordas no mobile
        slidesOffsetBefore={16} // Padding no início (mobile)
        slidesOffsetAfter={16}  // Padding no final (mobile)

        breakpoints={{
          // 640px (Tablets) - Volta para números inteiros
          640: {
            slidesPerView: 2,
            spaceBetween: 20,
            slidesOffsetBefore: 0, // Remove padding extra
            slidesOffsetAfter: 0,  // Remove padding extra
            loop: enableLoop,
          },
          // 1024px (Desktops) - Volta para números inteiros
          1024: {
            slidesPerView: 3,
            spaceBetween: 30,
            slidesOffsetBefore: 0, // Remove padding extra
            slidesOffsetAfter: 0,  // Remove padding extra
            loop: enableLoop,
          },
        }}
        a11y={{
            prevSlideMessage: 'Slide anterior',
            nextSlideMessage: 'Próximo slide',
        }}
      >
        {videos.map((video, index) => (
          // *** AJUSTADO: Definindo largura explícita para 'auto' funcionar ***
          // Usando w-4/5 (80%) ou w-3/4 (75%)
          <SwiperSlide key={video.id + '-' + index} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm w-4/5 sm:w-auto flex-shrink-0"> {/* Largura mobile, sm:w-auto reseta */}
            {/* Container responsivo para o vídeo */}
            <div className="aspect-video w-full bg-black">
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
       <button className="swiper-button-prev-custom absolute top-1/2 left-2 transform -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full p-2 shadow-md text-brand-dark hover:text-brand-pink transition-all disabled:opacity-30 disabled:cursor-not-allowed"> {/* Ajustado left */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button className="swiper-button-next-custom absolute top-1/2 right-2 transform -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full p-2 shadow-md text-brand-dark hover:text-brand-pink transition-all disabled:opacity-30 disabled:cursor-not-allowed"> {/* Ajustado right */}
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

        /* Container principal: Garante que não expanda e esconda o overflow */
        .video-carousel-container {
            /* w-full já aplicado via Tailwind */
            /* overflow-hidden já aplicado via Tailwind */
            /* Remove padding interno, Swiper cuidará disso com offsets */
             padding-left: 0;
             padding-right: 0;
        }

        /* Estilo dos slides */
        .mySwiper .swiper-slide {
           transition: none;
           opacity: 1;
           transform: none;
           height: auto; /* Garante altura correta */
           /* A largura é definida pela classe Tailwind no slide */
        }

        /* Garante que o Swiper não tenha overflow próprio */
        .mySwiper {
            width: 100%;
            overflow: hidden; /* <<< MUDANÇA: Esconde overflow interno */
            padding: 0;
            margin: 0; /* Remove margens negativas */
            /* Adiciona propriedade para melhorar swipe em touch devices */
            touch-action: pan-y; /* Permite scroll vertical enquanto detecta swipe horizontal */
        }

        /* --- Estilos para Telas Maiores (sm: 640px+) --- */
        @media (min-width: 640px) {
            /* Mostra os botões novamente */
            .swiper-button-prev-custom,
            .swiper-button-next-custom {
                display: block;
            }

             /* Posiciona os botões DENTRO do container em telas maiores */
            .video-carousel-container {
                overflow: hidden; /* Mantém hidden para conter os botões */
            }
            /* Ajusta posição dos botões para ficarem DENTRO nas laterais */
            .swiper-button-prev-custom { left: 0.5rem; } /* Exemplo: 8px */
            .swiper-button-next-custom { right: 0.5rem; } /* Exemplo: 8px */

            .mySwiper {
                 overflow: hidden; /* Mantém hidden */
                 touch-action: auto; /* Restaura padrão */
            }

             /* Estilos de slide para desktop */
              .mySwiper .swiper-slide {
                 opacity: 1;
                 transform: scale(1);
                 width: auto !important; /* <<< IMPORTANTE: Reseta a largura fixa do mobile */
              }
        }

      `}</style>
    </div>
  );
}
