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
        brand: {
          magenta: '#E74B6F',
          'magenta-dark': '#D54465',
          'magenta-bright': '#FF6EA9',
          'magenta-soft': '#FFF0F6',
          'rose-10': '#FFE9EE',
          peach: '#FF8B62',
          blue: '#0B57D0',
          'blue-dark': '#094AB4',
          'blue-light': '#4C8DFF',
          violet: '#6C2DB5',
          'violet-light': '#8A3CF1',
          dark: '#1C1C1E',
          light: '#FAFAFA',
          'text-secondary': '#6B6B6B',
          'glass-100': '#F6F8FB',
          'glass-200': '#F4F6FD',
          'glass-border': '#E3E8F4',
          'chip-border': '#D8E1F5',
          green: '#58CC91',
          yellow: '#F9D65C',
        },
        accent: {
          'indigo-soft': '#EEF3FF',
          'indigo-border': '#E6EEFF',
          'violet-soft': '#F7F1FF',
          'violet-ghost': '#F2E9FF',
          'blue-soft': '#F0F4FF',
          'blue-bright': '#2C7BFF',
          'blue-ink': '#214072',
          'violet-ink': '#453068',
          'violet-bright': '#9346EB',
          'slate-600': '#2F3B5C',
          'ink-08': '#0C1D38',
        },
        neutral: {
          0: '#FFFFFF',
          25: '#FDF3F8',
          50: '#F9FAFD',
          75: '#F7F8FB',
          100: '#F3F5FD',
          200: '#E6E9F3',
          300: '#DADDE7',
          400: '#C7CBDC',
          500: '#55586A',
        },
        // compatibilidade legado
        primary: '#1D4ED8',
        primaryLight: '#93C5FD',
        grayDark: '#374151',
        grayLight: '#9CA3AF',
      },
      backgroundImage: {
        'landing-hero': 'radial-gradient(140% 120% at 50% -20%, rgba(231, 75, 111, 0.12) 0%, rgba(231, 75, 111, 0) 68%)',
        'landing-brand': 'radial-gradient(120% 140% at 50% -20%, rgba(255, 110, 169, 0.18) 0%, rgba(255, 110, 169, 0) 75%)',
        'landing-data': 'radial-gradient(120% 120% at 20% 0%, rgba(11, 87, 208, 0.12) 0%, rgba(11, 87, 208, 0) 55%)',
        'landing-testimonial': 'radial-gradient(160% 120% at 30% 0%, rgba(255, 110, 169, 0.22) 0%, rgba(255, 110, 169, 0) 68%)',
      },
      boxShadow: {
        'glass-md': '0 14px 36px rgba(12, 29, 56, 0.10)',
        'glass-lg': '0 26px 60px rgba(12, 29, 56, 0.12)',
        'glass-xl': '0 34px 80px rgba(12, 29, 56, 0.16)',
        'brand-magenta': '0 18px 48px rgba(255, 95, 139, 0.22)',
        'brand-blue': '0 12px 28px rgba(11, 87, 208, 0.24)',
      },
      borderColor: {
        'brand-glass': '#E3E8F4',
        'brand-chip': '#D8E1F5',
      },
      ringColor: {
        brand: '#0B57D0',
        magenta: '#E74B6F',
      },
      backdropBlur: {
        glass: '18px',
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
