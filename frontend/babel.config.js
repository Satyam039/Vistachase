// StyleX compilation, following the Astryx Next.js + StyleX example
// (github.com/facebook/astryx/tree/main/apps/example-nextjs-stylex).
// A Babel config switches Next.js from SWC to Babel for app code; that is the
// officially supported way to compile stylex.create() / xstyle in Next.js.
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");

const dev = process.env.NODE_ENV !== "production";

module.exports = {
  presets: ["next/babel"],
  plugins: [
    [
      "@stylexjs/babel-plugin",
      {
        dev,
        runtimeInjection: false,
        enableInlinedConditionalMerge: true,
        treeshakeCompensation: true,
        aliases: {
          "@/*": [path.join(__dirname, "src", "*")],
        },
        classNamePrefix: "p",
        unstable_moduleResolution: {
          type: "commonJS",
        },
      },
    ],
  ],
};
