// tailwind.config.ts (Atualizado com Manual da Marca e Sintaxe TS)

import type { Config } from 'tailwindcss' // Importa o tipo Config

const config: Config = { // Define o tipo da configuração
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Define Poppins como a fonte principal 'sans'
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
      },
      colors: {
        // Cores definidas no Manual da Marca
        'brand-dark': '#191E1E', // Preto/Cinza Escuro
        'brand-red': '#FF2D3A',  // Vermelho
        'brand-pink': '#F6007B', // Rosa/Magenta
        'brand-light': '#F0F7F7', // Branco/Cinza Claro

        // Cores antigas (decida se mantém ou remove)
        primary: "#1D4ED8",
        primaryLight: "#93C5FD",
        grayDark: "#374151",
        grayLight: "#9CA3AF",
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        // Adicionar shimmer se necessário
      },
      keyframes: {
        // Adicionar shimmer se necessário
        // shimmer: {
        //   '100%': { transform: 'translateX(100%)' },
        // }
      }
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
  ],
}

export default config // Exporta a configuração
