import type { Config } from "tailwindcss";
import { astryxThemeExtension } from "./src/themes/astryx-tailwind-bridge";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // The site's own shadow-card utility would also match a shadow color named "card"
    // from the Astryx bridge, so card is left out of shadow colors.
    boxShadowColor: ({ theme }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { card, ...colors } = theme("colors");
      return colors;
    },
    extend: {
      ...astryxThemeExtension,
      colors: {
        ...astryxThemeExtension.colors,
        ocean: {
          950: "#061314",
          900: "#0c1f21",
          800: "#14363a",
          700: "#1e5258",
          600: "#2a757e",
          500: "#3a9ca6", // Primary Ocean Teal
          400: "#5ab0ba",
          300: "#84c7ce",
          200: "#b5e1e6",
          100: "#daf0f2",
          50: "#f0f9fa",
        },
        summit: {
          700: "#c29600",
          600: "#daa500",
          500: "#f5bf03", // Primary Golden Summit
          400: "#fad23d",
          300: "#ffe085", // Golden Tint
          200: "#ffecb3",
          100: "#fff7db",
        },
        obsidian: {
          950: "#0e1012",
          900: "#1c1f23", // Obsidian Black
          800: "#2d3238",
          700: "#40464f",
          600: "#5a626d",
          500: "#757e8c",
          400: "#949eac",
          300: "#bac2cc",
          200: "#dce0e5",
          100: "#f0f2f5",
          50: "#f9f9f7",  // Frost White
        },
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
          500: "#f5bf03",
          400: "#dfb658",
          300: "#ffe085",
          200: "#fae9b8",
          100: "#fdf6e2",
        },
        rockies: {
          sky: "#eaf3fa",
          ice: "#d4e7f5",
          glacier: "#73a5c6",
          slate: "#334155",
          charcoal: "#1c1f23",
          dark: "#0c1f21",
        }
      },
      fontFamily: {
        ...astryxThemeExtension.fontFamily,
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-montserrat)", "sans-serif"],
        editorial: ["Georgia", "Playfair Display", "serif"],
      },
      boxShadow: {
        ...astryxThemeExtension.boxShadow,
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
