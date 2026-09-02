"use client";

import { useEffect } from "react";

/* Entrada por scroll para os blocos marcados com `.d2c-v6-reveal`.
   Fica num componente próprio (e não em cada seção) porque as seções são
   server components — só o observador precisa rodar no cliente.

   Duas decisões de robustez, nesta ordem de importância:

   1. O estado escondido é OPT-IN: o CSS só esconde os blocos depois que este
      efeito marca `data-v6-reveal="on"` na raiz. Sem JS, com JS quebrado ou
      com o script ainda carregando, a página aparece inteira. Antes disso a
      landing dependia do JS para ser legível — qualquer falha deixava tudo em
      branco.
   2. A detecção é por scroll + rAF, não por IntersectionObserver. É mais
      simples de garantir em qualquer navegador e não deixa a página refém de
      uma API que pode não disparar.

   Quem já está na viewport no primeiro quadro aparece sem animar: animar o que
   o visitante já está lendo é piscada, não entrada. */
export function RevealOnScroll() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".d2c-v6");
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".d2c-v6-reveal"));
    if (!root || nodes.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Viewport de altura zero (aba em background, painel embutido oculto,
       captura de thumbnail): nada jamais "entra em cena", então ligar o estado
       escondido deixaria a página em branco. Melhor não animar. */
    const viewport = () => window.innerHeight || document.documentElement.clientHeight || 0;
    if (viewport() === 0) return;

    const pending = new Set(nodes);
    let frame = 0;

    const reveal = (node: HTMLElement) => {
      pending.delete(node);
      const delay = Number(node.dataset.revealDelay ?? 0);
      if (delay > 0) window.setTimeout(() => node.classList.add("is-in"), delay);
      else node.classList.add("is-in");
    };

    /* Primeiro quadro: quem já está visível entra sem animação, então o estado
       escondido nem chega a ser aplicado a esses blocos. */
    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.top < viewport() && rect.bottom > 0) {
        node.classList.add("is-in");
        pending.delete(node);
      }
    });

    root.dataset.v6Reveal = "on";

    const check = () => {
      frame = 0;
      const limit = viewport() * 0.92;
      pending.forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.top < limit && rect.bottom > 0) reveal(node);
      });
      if (pending.size === 0) detach();
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(check);
    };

    /* O evento de scroll é só a via rápida. Quem realmente conduz é este
       intervalo: há contextos onde o listener nunca dispara (webviews e painéis
       embutidos, entre outros) e, sem um segundo mecanismo, tudo abaixo da
       primeira dobra ficaria escondido para sempre. Ler o retângulo de ~20
       elementos a cada 250 ms é barato, e o intervalo morre assim que o último
       bloco entra. */
    const poll = window.setInterval(check, 250);

    function detach() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearInterval(poll);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    check();

    return detach;
  }, []);

  return null;
}
