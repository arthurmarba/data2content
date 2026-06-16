"use client";

import Image from "next/image";
import React from "react";

type MentorshipSectionProps = {
  onCta: () => void;
  nextMentorshipLabel?: string | null;
};

type MentorshipPhoto = {
  src: string;
  alt: string;
  caption: string;
};

const photos: MentorshipPhoto[] = [
  {
    src: "/images/WhatsApp Image 2025-07-07 at 14.00.20.png",
    alt: "Reunião da comunidade Data2Content com creators ao vivo",
    caption: "Reunião da comunidade ao vivo",
  },
  {
    src: "/images/WhatsApp Image 2025-07-07 at 14.00.21 (1).png",
    alt: "Trocas da comunidade Data2Content",
    caption: "Leitura de conteúdo em grupo",
  },
  {
    src: "/images/WhatsApp Image 2025-07-07 at 14.00.21 (3).png",
    alt: "Criadores ajustando estratégia de imagem na comunidade Data2Content",
    caption: "Estratégia de imagem, criador a criador",
  },
];

const MentorshipSection: React.FC<MentorshipSectionProps> = ({ onCta }) => {
  return (
    <section id="mentoria" className="bg-[#FFF7FB] py-10 md:py-16">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center">
          <div className="space-y-6 text-[#1F1A1C]">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#EC4899]">
              Comunidade
            </p>
            <h2 className="text-2xl font-extrabold md:text-[2rem]">
              Você não está mais criando conteúdo sozinho.
            </h2>
            <p className="text-base text-[#6B4E57]">
              Toda semana a comunidade se reúne ao vivo pra ler conteúdo junto — analisar o que está funcionando e ajustar a estratégia de imagem de cada criador.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: "🎬", title: "Análise de conteúdo", text: "A comunidade lê seus posts e aponta o que conecta com sua narrativa." },
                { icon: "🪞", title: "Estratégia de imagem", text: "Como você quer ser visto — ajustado em grupo, criador a criador." },
                { icon: "🤝", title: "Referências da semana", text: "Cases frescos e ideias que nascem da própria comunidade." },
              ].map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_16px_38px_rgba(236,72,153,0.12)]"
                >
                  <span className="text-xl">{item.icon}</span>
                  <h3 className="mt-2 text-sm font-semibold text-[#1F1A1C]">{item.title}</h3>
                  <p className="mt-1 text-xs text-[#6B4E57]">{item.text}</p>
                </article>
              ))}
            </div>
            <button
              type="button"
              onClick={onCta}
              className="inline-flex items-center justify-center rounded-2xl bg-[#F6007B] px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(246,0,123,0.22)] transition hover:bg-[#D10068]"
            >
              Participar da comunidade
            </button>
          </div>

          <div className="-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:snap-none">
            {photos.map((photo, index) => (
              <figure
                key={photo.src}
                className={`relative aspect-[4/5] min-w-[220px] snap-center overflow-hidden rounded-3xl border border-white/60 shadow-[0_22px_55px_rgba(236,72,153,0.18)] ${
                  index === 1 ? "sm:col-span-2 sm:aspect-[16/9] sm:min-w-0" : ""
                }`}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 400px"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1F1A1C]/80 via-[#1F1A1C]/10 to-transparent px-4 pb-4 pt-8 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                  {photo.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MentorshipSection;
