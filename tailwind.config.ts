// tailwind.config.ts (Atualizado com a nova paleta de cores)

import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "360px",
        "sm-mobile": "480px",
        "md-mobile": "640px",
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      colors: {
        // Paleta 2025 Data2Content
        'brand-magenta': '#E74B6F',
        'brand-magenta-hover': '#D54465',
        'brand-dark': '#1C1C1E',
        'brand-light': '#FAFAFA',
        'brand-text-secondary': '#6B6B6B',
        'brand-green': '#58CC91',
        'brand-yellow': '#F9D65C',

        // compatibilidade legado
        primary: '#1D4ED8',
        primaryLight: '#93C5FD',
        grayDark: '#374151',
        grayLight: '#9CA3AF',
      },
      fontSize: {
        "display-xl": ["clamp(2.5rem, 6vw, 3.75rem)", { lineHeight: "1.05", fontWeight: "800" }],
        "display-lg": ["clamp(2.125rem, 5vw, 3.125rem)", { lineHeight: "1.08", fontWeight: "800" }],
        "heading-lg": ["clamp(1.5rem, 4vw, 2.25rem)", { lineHeight: "1.1", fontWeight: "700" }],
        "heading-md": ["clamp(1.25rem, 3.5vw, 1.75rem)", { lineHeight: "1.2", fontWeight: "600" }],
        "body-lg": ["clamp(1.0625rem, 2.6vw, 1.25rem)", { lineHeight: "1.6", fontWeight: "500" }],
        "body-md": ["clamp(0.95rem, 2.4vw, 1.05rem)", { lineHeight: "1.65", fontWeight: "500" }],
        "eyebrow": ["clamp(0.75rem, 1.9vw, 0.85rem)", { lineHeight: "1.3", letterSpacing: "0.22em" }],
      },
      spacing: {
        "fluid-1": "clamp(1rem, 3vw, 1.75rem)",
        "fluid-2": "clamp(1.5rem, 4vw, 2.5rem)",
        "fluid-3": "clamp(2rem, 6vw, 3.5rem)",
        "fluid-4": "clamp(2.5rem, 8vw, 4.5rem)",
      },
      borderRadius: {
        "2.5xl": "1.375rem",
        "3xl": "1.75rem",
      },
      maxWidth: {
        "content-xs": "480px",
        "content-sm": "640px",
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
    plugin(({ addBase }) => {
      addBase({
        '.text-eyebrow': {
          textTransform: 'uppercase',
        },
      });
    }),
  ],
}

export default config
