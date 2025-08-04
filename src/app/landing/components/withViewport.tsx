"use client";

import { useInView } from "react-intersection-observer";
import React from "react";

export default function withViewport<P>(Component: React.ComponentType<P>) {
  return function WrappedComponent(props: P) {
    const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
    return <div ref={ref}>{inView ? <Component {...props} /> : null}</div>;
  };
}

