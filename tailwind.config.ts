import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          950: "#04120e",
          900: "#072019",
          850: "#0b2c22",
          800: "#0f382c",
          700: "#164d3d",
          600: "#1f6853",
          500: "#2d8b70",
          400: "#44ab8d",
          300: "#6bc4ac",
          100: "#d3f1e8",
          50: "#f0faf7",
        },
        gold: {
          600: "#a97b25",
          500: "#c89b3c",
          400: "#dfb658",
          300: "#edd084",
          200: "#fae9b8",
          100: "#fdf6e2",
        },
        rockies: {
          sky: "#eaf3fa",
          ice: "#d4e7f5",
          glacier: "#73a5c6",
          slate: "#334155",
          charcoal: "#1e293b",
          dark: "#0f172a",
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-montserrat)", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        card: "0 10px 30px -5px rgba(7, 32, 25, 0.08)",
        glow: "0 0 25px rgba(200, 155, 60, 0.35)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        }
      }
    },
  },
  plugins: [],
};
export default config;
