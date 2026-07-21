"use client";

import { Dialog } from "@headlessui/react";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { Brand } from "./Brand";
import { LandingAuthCta } from "./LandingAuthCta";

const NAV_LINKS = [
  { href: "#reuniao-semanal", label: "Reunião semanal" },
  { href: "#quem-conduz", label: "Quem analisa" },
  { href: "#planos", label: "Plano Pro" },
] as const;

export function NarrativeHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="d2c-landing-header">
      <div className="d2c-shell d2c-landing-header__inner">
        <Brand priority />
        <nav className="d2c-landing-header__nav" aria-label="Navegação principal">
          {NAV_LINKS.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
        </nav>
        <div className="d2c-landing-header__actions">
          <LandingAuthCta className="d2c-button d2c-button--small" guestLabel="Assistir grátis" authenticatedLabel="Acessar a D2C" trackingLocation="header" />
        </div>
        <button
          className="d2c-menu-button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          aria-controls="d2c-mobile-menu"
          aria-expanded={menuOpen}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <Dialog static open={menuOpen} onClose={setMenuOpen} className="d2c-mobile-dialog">
            <motion.div className="d2c-mobile-dialog__backdrop" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <Dialog.Panel
              as={motion.div}
              id="d2c-mobile-menu"
              className="d2c-mobile-menu"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="d2c-mobile-menu__topline">
                <Dialog.Title>Menu</Dialog.Title>
                <button onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={19} aria-hidden="true" /></button>
              </div>
              <nav aria-label="Navegação mobile">
                {NAV_LINKS.map((item) => <a href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
              </nav>
              <LandingAuthCta
                className="d2c-mobile-menu__cta"
                guestLabel="Assistir à próxima reunião"
                authenticatedLabel="Acessar a D2C"
               
                trackingLocation="mobile-menu"
                onNavigate={() => setMenuOpen(false)}
              />
            </Dialog.Panel>
          </Dialog>
        )}
      </AnimatePresence>
    </header>
  );
}
