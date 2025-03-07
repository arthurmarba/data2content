// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      colors: {
        primary: "#1D4ED8", // Azul primário
        primaryLight: "#93C5FD", // Azul claro
        grayDark: "#374151",
        grayLight: "#9CA3AF",
      },
    },
  },
  plugins: [
    require("@tailwindcss/aspect-ratio"), 
  ],
};
