import Image from 'next/image';
import React from 'react';

type Row = {
  title: string;
  text: string;
  img: { src: string; alt: string };
};

const rows: Row[] = [
  {
    title: 'Planejamento',
    text:
      'Organize sua produção com clareza: metas, frequência e formatos. A IA ajuda a priorizar o que traz resultado.',
    img: { src: '/images/portfolio_exemplo.png', alt: 'Planejamento de conteúdo' },
  },
  {
    title: 'Pautas de Conteúdo',
    text:
      'Receba sugestões de temas e roteiros prontos com base no que funciona para você e no seu nicho.',
    img: { src: '/images/Tutorial.png', alt: 'Lista de pautas de conteúdo' },
  },
  {
    title: 'Inspirações',
    text:
      'Descubra referências visuais e formatos que combinam com seu estilo e elevam sua apresentação.',
    img: { src: '/images/mulher_se_maquiando.png', alt: 'Inspirações de formatos' },
  },
  {
    title: 'Categorias',
    text:
      'Classifique seus posts por proposta, contexto, tom e referência. Portfólio sempre organizado para marcas.',
    img: { src: '/images/Colorido-Simbolo.png', alt: 'Categorias e taxonomias' },
  },
];

export default function FeatureRowsSection() {
  return (
    <section className="border-t border-[#E6EAFB] bg-white py-16 text-brand-dark md:py-20">
      <div className="container mx-auto px-6">
        <div className="space-y-12">
          {rows.map((row, i) => {
            const isOdd = i % 2 === 1;
            return (
              <div key={row.title} className="grid grid-cols-1 items-center gap-8 md:grid-cols-12">
                {/* Imagem: esquerda (pares) / direita (ímpares em md+) */}
                <div className={`md:col-span-5 ${isOdd ? 'md:order-2' : 'md:order-1'}`}>
                  <div className="relative w-full h-56 sm:h-64 md:h-72 lg:h-80 rounded-xl overflow-hidden ring-1 ring-black/10 bg-white shadow-md">
                    <Image src={row.img.src} alt={row.img.alt} fill className="object-contain" />
                  </div>
                </div>
                {/* Texto: direita (pares) / esquerda (ímpares em md+) */}
                <div className={`md:col-span-7 ${isOdd ? 'md:order-1' : 'md:order-2'}`}>
                  <h3 className="mb-2 text-xl font-semibold leading-snug text-brand-dark md:text-2xl">
                    {row.title}
                  </h3>
                  <p className="text-base leading-normal text-brand-text-secondary md:text-lg">
                    {row.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
