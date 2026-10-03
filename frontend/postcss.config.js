/* eslint-disable @typescript-eslint/no-require-imports */
const babelConfig = require("./babel.config");

module.exports = {
  plugins: {
    // Collects every stylex.create() in src/ and writes the CSS where globals.css says @stylex.
    "@stylexjs/postcss-plugin": {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      babelConfig: {
        babelrc: false,
        parserOpts: {
          plugins: ["typescript", "jsx"],
        },
        plugins: babelConfig.plugins,
      },
      useCSSLayers: {
        // Layers declared in src/app/layers.css come first, so StyleX app styles
        // override Astryx component defaults; Tailwind utilities stay unlayered on top.
        before: ["reset", "tw-preflight", "astryx-base", "astryx-theme"],
      },
    },
    tailwindcss: {},
    autoprefixer: {},
  },
};
