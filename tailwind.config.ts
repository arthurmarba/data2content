// tailwind.config.ts (Atualizado com as cores do design de referência)

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
        // CORREÇÃO: As cores foram ajustadas para corresponder ao design de referência do botão.
        'brand-dark': '#111827',
        'brand-red': '#EF4444',  // Cor do gradiente do botão
        'brand-pink': '#EC4899', // Cor do gradiente e da sombra do botão
        'brand-light': '#F0F7F7',

        // Cores antigas mantidas para referência
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
