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
        className="pointer-events-auto bg-gradient-to-t from-white via-white/95 to-transparent px-3 pb-0 pt-2"
        style={{ paddingBottom }}
      >
        <div className="mx-auto flex max-w-content-sm flex-col gap-1.5 rounded-xl border border-brand-glass bg-white/95 px-2.5 py-2.5 text-center text-brand-dark shadow-[0_12px_28px_rgba(15,23,42,0.14)] backdrop-blur-lg">
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-bold text-white transition-transform duration-200 hover:bg-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary active:scale-[0.99]"
          >
            {label}
          </button>
          {description ? (
            <p className="line-clamp-1 text-[11px] font-medium leading-tight text-brand-text-secondary/80">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MobileStickyCta;
