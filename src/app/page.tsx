"use client";

import { useSession, signIn } from "next-auth/react";
import Head from "next/head";
import { FaCheckCircle, FaDollarSign, FaWhatsapp } from "react-icons/fa";

export default function HomePage() {
  // Removemos 'status' para evitar variáveis não usadas
  const { data: session } = useSession();

  return (
    <>
      <Head>
        <title>data2content - Potencialize seu Instagram</title>
        <meta
          name="description"
          content="Transforme suas métricas do Instagram em insights valiosos e receba dicas de conteúdo direto no WhatsApp. Faça parte e ganhe comissões!"
        />
        {/* Meta Tags Open Graph */}
        <meta property="og:title" content="data2content - Potencialize seu Instagram" />
        <meta
          property="og:description"
          content="Transforme suas métricas do Instagram em insights valiosos e receba dicas de conteúdo direto no WhatsApp."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://seusite.com" />
        <meta property="og:image" content="https://seusite.com/imagem-og.jpg" />

        {/* Meta Tags Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="data2content - Potencialize seu Instagram" />
        <meta
          name="twitter:description"
          content="Transforme suas métricas do Instagram em insights valiosos e receba dicas de conteúdo direto no WhatsApp."
        />
        <meta name="twitter:image" content="https://seusite.com/imagem-twitter.jpg" />

        {/*
          Fonte Poppins
          Se quiser mover para _document.tsx ou layout.tsx, removeria este disable.
          Aqui desabilitamos apenas para esta linha:
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Fundo gradiente animado */}
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-animated-gradient font-poppins relative">
        {/* DECORAÇÃO SUTIL (opcional) */}
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-cover" />

        {/* Card central (Mobile First) */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full text-gray-800 relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-800 mb-3">
            data2content
          </h1>
          <p className="text-sm md:text-base text-gray-600 mb-6 leading-relaxed">
            Conecte seu Instagram e transforme suas métricas em{" "}
            <span className="font-semibold">insights valiosos!</span>
          </p>

          {/* Vídeo explicativo */}
          <div className="mb-6 relative">
            <div className="relative pb-[56.25%] overflow-hidden rounded-lg shadow-lg">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/SEU_VIDEO_ID"
                title="Explicação dos Benefícios"
                frameBorder="0"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 animate-fadeOut">
                <span className="text-white text-xs md:text-sm font-semibold">
                  Assista e conheça os Benefícios
                </span>
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-2">
              Veja como podemos turbinar seu Instagram.
            </p>
          </div>

          {/* Seção de benefícios */}
          <div className="space-y-5 mb-6">
            <div className="flex items-start space-x-2">
              <FaCheckCircle
                className="text-green-500 mt-[3px] hover:scale-110 transition-transform duration-200"
                size={18}
              />
              <div>
                <h2 className="text-sm md:text-base font-semibold text-gray-800">
                  Ganhe Comissões
                </h2>
                <p className="text-xs md:text-sm text-gray-600 leading-snug">
                  Receba um cupom exclusivo e conquiste renda extra ao indicar novos parceiros.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <FaWhatsapp
                className="text-green-500 mt-[3px] hover:scale-110 transition-transform duration-200"
                size={18}
              />
              <div>
                <h2 className="text-sm md:text-base font-semibold text-gray-800">
                  Consultoria via WhatsApp
                </h2>
                <p className="text-xs md:text-sm text-gray-600 leading-snug">
                  Tenha acesso a um especialista que orienta seu planejamento de conteúdo em tempo real.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <FaDollarSign
                className="text-green-500 mt-[3px] hover:scale-110 transition-transform duration-200"
                size={18}
              />
              <div>
                <h2 className="text-sm md:text-base font-semibold text-gray-800">
                  Parceria Exclusiva
                </h2>
                <p className="text-xs md:text-sm text-gray-600 leading-snug">
                  Faça parte de nossa comunidade e desfrute de vantagens únicas.
                </p>
              </div>
            </div>
          </div>

          {/* Botão de login */}
          {!session ? (
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="shimmer-button w-full py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-300 text-base md:text-lg transform hover:scale-105 relative overflow-hidden"
            >
              Entrar com Google
            </button>
          ) : (
            <div className="text-gray-700 text-sm md:text-base text-center">
              Você já está logado!
              <br />
              <a
                href="/dashboard"
                className="underline text-indigo-600 hover:text-indigo-800"
              >
                Ir para o Dashboard
              </a>
            </div>
          )}
        </div>
      </div>

      {/* CSS customizado para animações */}
      <style jsx>{`
        .bg-animated-gradient {
          background: linear-gradient(45deg, #8e2de2, #4a00e0, #0f9b0f, #00c6ff);
          background-size: 400% 400%;
          animation: gradientAnimation 15s ease infinite;
        }
        @keyframes gradientAnimation {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        @keyframes fadeOut {
          0% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .animate-fadeOut {
          animation: fadeOut 5s ease forwards;
        }

        /* Botão com shimmer (brilho) */
        .shimmer-button {
          position: relative;
          overflow: hidden;
        }
        .shimmer-button::before {
          content: "";
          position: absolute;
          top: 0;
          left: -150%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-20deg);
        }
        .shimmer-button:hover::before {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% {
            left: -150%;
          }
          50% {
            left: 100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </>
  );
}
