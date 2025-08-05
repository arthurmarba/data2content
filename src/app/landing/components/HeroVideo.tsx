'use client';

export default function HeroVideo() {
  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      controls
      poster="/images/tuca-analise-whatsapp.png"
      className="w-full max-w-4xl mx-auto rounded-2xl shadow-xl aspect-video"
      preload="none"
      loading="lazy"
      decoding="async"
    >
      <source src="/videos/hero-demo.webm" type="video/webm" />
      <source src="/videos/hero-demo.mp4" type="video/mp4" />
      Seu navegador não suporta o elemento de vídeo.
    </video>
  );
}

