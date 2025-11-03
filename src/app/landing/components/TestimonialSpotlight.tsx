"use client";

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

const TestimonialSpotlight: React.FC<TestimonialSpotlightProps> = ({
  quote = DEFAULT_QUOTE,
  authorName = "Lívia Linhares",
  authorRole = "criadora e membro PRO",
  mediaKitUrl = "/signup",
}) => {
  return (
    <section className="border-t border-[#F5C8DA] bg-[#FDF2F8] py-16 text-brand-dark md:py-20">
      <div className="container mx-auto max-w-4xl px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-magenta md:text-sm">
          Depoimento real
        </span>
        <blockquote className="mt-6 space-y-6">
          <p className="text-[1.75rem] font-semibold leading-snug md:text-[2.25rem]">“{quote}”</p>
          <footer className="text-sm font-medium text-brand-text-secondary md:text-base">
            —{" "}
            {mediaKitUrl ? (
              <Link href={mediaKitUrl} className="text-brand-magenta underline-offset-4 hover:underline">
                {authorName}
              </Link>
            ) : (
              authorName
            )}
            , {authorRole}
          </footer>
        </blockquote>
      </div>
    </section>
  );
};

export default TestimonialSpotlight;
