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
          600: "#257780", // Ocean Teal for text and controls on light surfaces (5.2:1 on white, AA)
          500: "#3a9ca6", // Primary Ocean Teal (3.2:1 on white: icons, large shapes, dark surfaces)
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
        // Legacy palette names from the original build, now pointing at the Vista Chase brand
        // colours (live site: Ocean Teal, Golden Summit) so older pages render on-brand.
        forest: {
          950: "#061314",
          900: "#0c1f21",
          850: "#10292c",
          800: "#14363a",
          700: "#1e5258",
          600: "#257780",
          500: "#3a9ca6",
          400: "#5ab0ba",
          300: "#84c7ce",
          100: "#daf0f2",
          50: "#f0f9fa",
        },
        gold: {
          600: "#c29600",
          500: "#f5bf03",
          400: "#fad23d",
          300: "#ffe085",
          200: "#ffecb3",
          100: "#fff7db",
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
      // The site reads light and large: no bold weights (bold/semibold/extrabold/black are medium)
      // and every text size one step larger than Tailwind's defaults.
      fontWeight: {
        semibold: "500",
        bold: "500",
        extrabold: "500",
        black: "500",
      },
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.15rem" }],
        sm: ["0.9375rem", { lineHeight: "1.4rem" }],
        base: ["1.0625rem", { lineHeight: "1.65rem" }],
        lg: ["1.1875rem", { lineHeight: "1.8rem" }],
        xl: ["1.375rem", { lineHeight: "1.9rem" }],
        "2xl": ["1.625rem", { lineHeight: "2.15rem" }],
        "3xl": ["2rem", { lineHeight: "2.5rem" }],
        "4xl": ["2.5rem", { lineHeight: "2.9rem" }],
        "5xl": ["3.25rem", { lineHeight: "1.1" }],
        "6xl": ["4rem", { lineHeight: "1.05" }],
        "7xl": ["4.75rem", { lineHeight: "1.05" }],
      },
      fontFamily: {
        ...astryxThemeExtension.fontFamily,
        // IBM Plex Sans everywhere: the "serif", "display" and "editorial" styles used by the
        // cinematic sections render in IBM Plex Sans too, so the site has one typeface.
        sans: ["var(--font-plex-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-plex-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        display: ["var(--font-plex-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        editorial: ["var(--font-plex-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        ...astryxThemeExtension.boxShadow,
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        card: "0 10px 30px -5px rgba(28, 31, 35, 0.08)",
        glow: "0 0 25px rgba(245, 191, 3, 0.35)",
      },
      // Decorative motion stops on its own within 5 seconds (WCAG 2.2.2 Pause, Stop, Hide):
      // Tailwind's ping/pulse/bounce default to infinite. animate-spin (loading) is left as is.
      animation: {
        ping: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        pulse: "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        bounce: "bounce 1.5s infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 4s ease-in-out infinite",
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
