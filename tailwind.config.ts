// tailwind.config.ts (Atualizado com a nova paleta de cores)

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      colors: {
        // ====================================================================
        // NOVA PALETA DE CORES (Estilo Play9) - Adicionada para a nova Landing Page
        // ====================================================================
        'brand-purple': '#5D3FD3', // Roxo principal vibrante
        'brand-magenta': '#E73B7C', // Magenta/Rosa para CTAs e destaques
        'brand-orange': '#F28500',  // Laranja energético para cards
        'brand-teal': '#006A71',    // Verde-azulado escuro para cards
        'brand-yellow': '#F3FF00', // Amarelo/limão elétrico para o CTA final

        // Cores existentes mantidas para compatibilidade com o resto do sistema
        'brand-dark': '#111827',
        'brand-red': '#EF4444',
        'brand-pink': '#EC4899', // Mantido, mas a nova LP usa 'brand-magenta'
        'brand-light': '#F0F7F7',

        // Cores antigas
        primary: "#1D4ED8",
        primaryLight: "#93C5FD",
        grayDark: "#374151",
        grayLight: "#9CA3AF",
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
  ],
}

export default config