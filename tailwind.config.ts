import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          850: "#1e293b",
          900: "#0f172a",
        },
        brand: {
          orange: "#FF9A00",
          white: "#ffffff",
          gray: "#A1A1A1",
          charcoal: "#4F4F4D",
        },
      },
      boxShadow: {
        glass: "0 8px 32px rgb(0 0 0 / 35%)",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
