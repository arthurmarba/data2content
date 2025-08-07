"use client";

import { useInView } from "react-intersection-observer";
import React from "react";

export default function withViewport<P>(Component: React.ComponentType<P>) {
  return function WrappedComponent(props: P) {
    const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
    const isServer = typeof window === "undefined";
    return (
      <div ref={isServer ? undefined : ref} suppressHydrationWarning>
        {isServer || inView ? <Component {...props} /> : null}
      </div>
    );
  };
}

