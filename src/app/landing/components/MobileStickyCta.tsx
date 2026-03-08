"use client";

import React from "react";

type MobileStickyCtaProps = {
  label: string;
  onClick: () => void;
  description?: string;
  hideUntilScroll?: boolean;
  scrollOffset?: number;
  showAfterTargetId?: string;
  intersectionThreshold?: number;
};

const DEFAULT_SCROLL_OFFSET = 280;

const MobileStickyCta: React.FC<MobileStickyCtaProps> = ({
  label,
  onClick,
  description,
  hideUntilScroll = true,
  scrollOffset = DEFAULT_SCROLL_OFFSET,
  showAfterTargetId,
  intersectionThreshold = 0.4,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [keyboardOffset, setKeyboardOffset] = React.useState(0);
  const [hasReachedTarget, setHasReachedTarget] = React.useState(false);
  const [hasScrolledEnough, setHasScrolledEnough] = React.useState(!hideUntilScroll);

  React.useEffect(() => {
    if (!showAfterTargetId) return;
    if (typeof window === "undefined") return;
    const target = document.getElementById(showAfterTargetId);
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setHasReachedTarget(true);
        }
      },
      { threshold: intersectionThreshold },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [showAfterTargetId, intersectionThreshold]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      if (!hideUntilScroll) {
        setHasScrolledEnough(true);
        return;
      }
      setHasScrolledEnough(window.scrollY > scrollOffset);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hideUntilScroll, scrollOffset]);

  React.useEffect(() => {
    const shouldShowByScroll = hideUntilScroll ? hasScrolledEnough : true;
    const shouldShowByTarget = showAfterTargetId ? hasReachedTarget : true;
    setIsVisible(shouldShowByScroll && shouldShowByTarget);
  }, [hasReachedTarget, hasScrolledEnough, hideUntilScroll, showAfterTargetId]);

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
        className="pointer-events-auto bg-gradient-to-t from-white via-white/92 to-transparent px-4 pb-0 pt-3"
        style={{ paddingBottom }}
      >
        <div className="mx-auto flex max-w-[23rem] flex-col gap-1.5 rounded-[1.35rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.96))] px-2 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[1rem] bg-brand-primary px-4 py-3 text-[0.95rem] font-black text-white shadow-[0_10px_24px_rgba(245,43,106,0.28)] transition-transform duration-200 hover:bg-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary active:scale-[0.99]"
          >
            {label}
          </button>
          {description ? (
            <p className="line-clamp-1 px-2 text-center text-[10px] font-medium leading-tight tracking-[0.01em] text-brand-text-secondary/75">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MobileStickyCta;
