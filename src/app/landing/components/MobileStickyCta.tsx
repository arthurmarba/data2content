"use client";

import React from "react";

type MobileStickyCtaProps = {
  label: string;
  onClick: () => void;
  description?: string;
  hideUntilScroll?: boolean;
  scrollOffset?: number;
};

const DEFAULT_SCROLL_OFFSET = 180;

const MobileStickyCta: React.FC<MobileStickyCtaProps> = ({
  label,
  onClick,
  description = "Sem cartão. Cancelamento a qualquer momento.",
  hideUntilScroll = true,
  scrollOffset = DEFAULT_SCROLL_OFFSET,
}) => {
  const [isVisible, setIsVisible] = React.useState(!hideUntilScroll);
  const [keyboardOffset, setKeyboardOffset] = React.useState(0);

  React.useEffect(() => {
    if (!hideUntilScroll) return;
    const handleScroll = () => {
      if (typeof window === "undefined") return;
      setIsVisible(window.scrollY > scrollOffset);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hideUntilScroll, scrollOffset]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(keyboardHeight);
    };

    handleResize();
    viewport.addEventListener("resize", handleResize);
    viewport.addEventListener("scroll", handleResize);
    return () => {
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", handleResize);
    };
  }, []);

  const paddingBottom = React.useMemo(() => {
    const base = 12; // 0.75rem
    return `calc(var(--sab, 0px) + ${Math.round(Math.max(keyboardOffset, 0))}px + ${base}px)`;
  }, [keyboardOffset]);

  return (
    <div
      className={[
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden",
        "transition-all duration-300 ease-out motion-reduce:transition-none",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0",
      ].join(" ")}
      aria-hidden={!isVisible}
    >
      <div
        className="pointer-events-auto bg-gradient-to-t from-white via-white/95 to-transparent px-4 pb-0 pt-4"
        style={{ paddingBottom }}
      >
        <div className="mx-auto flex max-w-content-sm flex-col gap-2 rounded-3xl border border-[#E7E7E7] bg-white/95 px-4 py-3 text-center text-brand-dark shadow-[0_-18px_48px_rgba(231,75,111,0.18)] backdrop-blur-lg">
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-magenta px-5 py-3 text-base font-semibold text-white shadow-[0_16px_32px_rgba(231,75,111,0.28)] transition-transform duration-200 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta hover:bg-brand-magenta-hover"
          >
            {label}
          </button>
          {description ? (
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-brand-text-secondary">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MobileStickyCta;
