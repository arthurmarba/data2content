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
    alt: "Mentoria Data2Content com creators ao vivo",
    caption: "Mentoria com 25 criadores ao vivo",
  },
  {
    src: "/images/WhatsApp Image 2025-07-07 at 14.00.21 (1).png",
    alt: "Trocas da comunidade Data2Content",
    caption: "Feedback coletivo e referências da semana",
  },
  {
    src: "/images/WhatsApp Image 2025-07-07 at 14.00.21 (3).png",
    alt: "Criadores compartilhando resultados na comunidade Data2Content",
    caption: "Resultados compartilhados na comunidade",
  },
];

const MentorshipSection: React.FC<MentorshipSectionProps> = ({ onCta }) => {
  return (
    <section id="mentoria" className="bg-[#FFF7FB] py-10 md:py-16">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center">
          <div className="space-y-6 text-[#1F1A1C]">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#EC4899]">
              Mentoria e comunidade
            </p>
            <h2 className="text-2xl font-extrabold md:text-[2rem]">
              Mentorias que conectam creators a dados e convites reais.
            </h2>
            <p className="text-base text-[#6B4E57]">
              Toda segunda às 19h criadores e marcas exploram o que funcionou, refinam portfólios e definem o próximo passo com apoio da Mobi.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: "🎯", title: "Hotseats", text: "Feedback direto com especialistas." },
                { icon: "🧠", title: "Referências", text: "Arquivos com cases frescos da comunidade." },
                { icon: "🚨", title: "Alertas Mobi", text: "Sinais de quando postar ou negociar." },
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
              Entrar na próxima mentoria
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
