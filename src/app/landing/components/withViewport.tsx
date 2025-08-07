"use client";

import { useInView } from "react-intersection-observer";
import React from "react";
import { motion } from "framer-motion";

// CORREÇÃO FINAL: A lógica foi alterada para controlar a visibilidade com animação,
// em vez de adicionar/remover o componente da tela. Isso resolve o erro de hidratação
// e o "flash" visual, garantindo uma transição suave.
export default function withViewport<T extends React.ComponentType<any>>(
  Component: T
) {
  const WrappedComponent = (props: React.ComponentProps<T>) => {
    const { ref, inView } = useInView({
      triggerOnce: true,
      // CORREÇÃO: O rootMargin foi reduzido para evitar que o scroll "trave" no final da página.
      rootMargin: "0px 0px -150px 0px", 
    });

    const variants = {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    };

    return (
      // Usamos motion.div para animar a entrada do componente.
      // O componente está sempre na tela, mas só fica visível (opacidade 1)
      // quando `inView` se torna verdadeiro.
      <motion.div
        ref={ref}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        variants={variants}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Component {...props} />
      </motion.div>
    );
  };

  WrappedComponent.displayName = `WithViewport(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent as T;
}
