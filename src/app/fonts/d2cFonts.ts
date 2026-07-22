// ─── Fontes do design system "creator-studio" (D2C) ──────────────────────────
// Declaração única das fontes da marca via next/font — Next gera um subset por
// fonte independentemente de quantos módulos importarem daqui. As CSS vars
// (--font-d2c-sans / --font-d2c-display) só têm efeito onde o `.variable` for
// aplicado num className; declarar aqui não muda nada visualmente.
//
// Consumidores: landing pública (NarrativeLandingPage) e o piloto do design
// system no app mobile (shell da aba Collabs).
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  variable: "--font-d2c-sans",
  display: "swap",
  adjustFontFallback: false,
});

export const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-d2c-display",
  display: "swap",
  adjustFontFallback: false,
});

// Classe pronta para escopar as duas vars num subtree.
export const d2cFontVariables = `${instrumentSans.variable} ${bricolageGrotesque.variable}`;
