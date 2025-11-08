"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

type TestimonialSpotlightProps = {
  quote?: string;
  authorName?: string;
  authorRole?: string;
  mediaKitUrl?: string;
};

const DEFAULT_QUOTE =
  "A Data2Content me ajudou a entender o que o mercado valoriza — e me ensinou a cobrar com estratégia.";

const HIGHLIGHT_STATS = [
  { label: "Postagens analisadas", value: "120+" },
  { label: "Crescimento em 60 dias", value: "+18%" },
  { label: "Total de seguidores", value: "320k" },
];

const DEFAULT_MEDIA = {
  src: "/images/Livia Foto D2C.png",
  alt: "Criadora com o dashboard aberto",
};

const TestimonialSpotlight: React.FC<TestimonialSpotlightProps> = ({
  quote = DEFAULT_QUOTE,
  authorName = "Lívia Linhares",
  authorRole = "criadora e membro PRO",
  mediaKitUrl = "/signup",
}) => {
  return (
    <section className="border-y border-[var(--landing-border)] bg-[var(--landing-surface)] py-16 text-[var(--landing-text)] md:py-20">
      <div className="container mx-auto max-w-5xl px-6">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--landing-text-muted)]">
              Depoimento real
            </p>
            <blockquote className="space-y-6">
              <p className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-snug text-[var(--landing-accent)]">
                “{quote}”
              </p>
              <footer className="text-sm text-[var(--landing-text-muted)] md:text-base">
                {authorName} · {authorRole}{" "}
                {mediaKitUrl ? (
                  <Link
                    href={mediaKitUrl}
                    className="ml-2 text-sm font-semibold text-[var(--landing-accent)] underline-offset-4 hover:underline"
                  >
                    Ver mídia kit
                  </Link>
                ) : null}
              </footer>
            </blockquote>
            <div className="grid gap-4 sm:grid-cols-3">
              {HIGHLIGHT_STATS.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[var(--landing-border)] bg-white/80 px-4 py-4 shadow-[0_24px_40px_rgba(15,23,42,0.04)]"
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--landing-accent)]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[32px] border border-[var(--landing-border)] bg-[var(--landing-surface-muted)]">
            <div className="relative aspect-[4/5]">
              <Image
                src={DEFAULT_MEDIA.src}
                alt={DEFAULT_MEDIA.alt}
                fill
                priority
                className="object-cover object-center grayscale"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialSpotlight;
