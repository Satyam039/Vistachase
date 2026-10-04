/**
 * Vista Chase Theme
 *
 * Stone (src/themes/stone/stoneTheme.ts) with the Vista Chase brand on top:
 * the live site's teal (#3A9CA6) as the accent and IBM Plex Sans as the typeface.
 * Everything else (neutrals, status colours, radius, shadows, the five-tier
 * responsive adaptations, component overrides) is inherited from Stone.
 *
 * Accent contrast (WCAG 2.x):
 *   #3A9CA6 brand teal on white is 3.2:1. Fine for icons and large shapes,
 *   too light for text or for white text on top of it, so:
 *   --color-accent      #257780  5.2:1 with white text, 4.7:1 on the body background
 *   --color-text-accent #226d75  5.4:1 on the body background (links, accent text)
 *   dark mode           #6cc9d2  8.9:1 on the dark surface; dark text on top (7.9:1)
 */

import {defineTheme} from '@astryxdesign/core/theme';
import {stoneTheme} from '../stone/stoneTheme';

export const vistachaseTheme = defineTheme({
  name: 'vistachase',
  extends: stoneTheme,

  // typography is a scale input, so extends replaces it: keep Stone's scale and set every
  // family to the Vista Chase typeface, IBM Plex Sans (self-hosted, src/app/fonts.css).
  typography: {
    scale: {base: 14, ratio: 1.25},
    body: {
      family: 'var(--font-plex-sans)',
      fallbacks: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    heading: {
      family: 'var(--font-plex-sans)',
      fallbacks: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      weights: {3: 'bold', 4: 'bold'},
    },
    code: {
      family: 'var(--font-plex-mono)',
      fallbacks: '"IBM Plex Mono", "SF Mono", Monaco, Consolas, monospace',
    },
  },

  tokens: {
    // Accent — Vista Chase teal
    '--color-accent': ['#257780', '#6cc9d2'],
    '--color-accent-muted': ['#2577801a', '#6cc9d226'], // 10% / 15%
    '--color-text-accent': ['#226d75', '#7fd3db'],
    '--color-icon-accent': ['#3a9ca6', '#6cc9d2'], // brand teal; icons need 3:1
    '--color-on-accent': ['#ffffff', '#0e2a2d'],
  },
});
