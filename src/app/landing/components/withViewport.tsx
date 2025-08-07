"use client";

import { useInView } from "react-intersection-observer";
import React from "react";

// CORREÇÃO: A tipagem do HOC foi ajustada para ser mais robusta.
// Usamos um tipo genérico 'T' para representar o tipo do componente de entrada
// e garantimos que o componente retornado mantenha esse tipo.
export default function withViewport<T extends React.ComponentType<any>>(
  Component: T
) {
  const WrappedComponent = (props: React.ComponentProps<T>) => {
    const { ref, inView } = useInView({
      triggerOnce: true,
      rootMargin: "200px",
    });
    const isServer = typeof window === "undefined";

    return (
      <div ref={isServer ? undefined : ref} suppressHydrationWarning>
        {isServer || inView ? <Component {...props} /> : null}
      </div>
    );
  };

  // Adiciona um displayName para facilitar a depuração no React DevTools.
  WrappedComponent.displayName = `WithViewport(${
    Component.displayName || Component.name || "Component"
  })`;

  // A conversão de tipo (casting) aqui ajuda o TypeScript a entender que
  // o componente retornado tem a mesma "forma" que o componente original,
  // resolvendo problemas de inferência com `next/dynamic`.
  return WrappedComponent as T;
}
