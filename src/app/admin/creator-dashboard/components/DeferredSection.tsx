"use client";

import React from "react";
import { useInView } from "react-intersection-observer";

interface DeferredSectionProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  minHeight?: string;
  rootMargin?: string;
}

export default function DeferredSection({
  children,
  placeholder,
  minHeight = "240px",
  rootMargin = "200px",
}: DeferredSectionProps) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin });

  return (
    <div ref={ref} style={{ minHeight }}>
      {inView ? children : placeholder ?? null}
    </div>
  );
}
