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
    <section id="ecossistema" className="landing-section landing-section--plain border-y border-[var(--landing-border)] text-[var(--landing-text)]">
      <div className="landing-section__inner landing-section__inner--wide">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <span className="landing-chip">Depoimento real</span>
            <blockquote className="space-y-6">
              <p className="text-display-lg text-balance font-semibold leading-snug text-[var(--landing-accent)]">
                “{quote}”
              </p>
              <footer className="text-body-md font-normal text-[var(--landing-text-muted)]">
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
          </div>
          <div className="relative overflow-hidden rounded-[32px] border border-[var(--landing-border)] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="relative aspect-[4/5]">
              <Image
                src={DEFAULT_MEDIA.src}
                alt={DEFAULT_MEDIA.alt}
                fill
                priority
                className="object-cover object-center"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-dark/10 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialSpotlight;
