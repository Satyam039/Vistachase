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

  // typography is a scale input, so extends replaces it. Every family is the Vista Chase
  // typeface, IBM Plex Sans (self-hosted, src/app/fonts.css). The site reads light and large:
  // base 15px (one step above Stone; the width tiers in stoneTheme.ts go 15/15/15/15/16/17)
  // and no bold anywhere (bold/semibold tokens are medium, below).
  typography: {
    scale: {base: 15, ratio: 1.25},
    body: {
      family: 'var(--font-plex-sans)',
      fallbacks: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    heading: {
      family: 'var(--font-plex-sans)',
      fallbacks: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      weights: {3: 'medium', 4: 'medium'},
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
    // No bold type: emphasis comes from size, not weight.
    '--font-weight-semibold': '500',
    '--font-weight-bold': '500',
  },

  components: {
    // The sticky site header must stay above page content while scrolling: the cinematic
    // sections create stacking contexts (z-10), which otherwise paint over the header and
    // hide keyboard focus in it (WCAG 2.4.11 Focus Not Obscured).
    'app-shell-header': {
      base: {zIndex: '40'},
    },
    // A page Layout that grows with its content (height="auto") must not also stretch to
    // min-height: 100%: inside the site's auto-height AppShell that pushed the footer out of
    // the scrollable area (its bottom links could not be reached on /search and /book).
    layout: {
      'height:auto': {minHeight: 'auto'},
    },
    // Form fields: on keyboard focus Astryx only tints the 1px border. Add the same 2px focus
    // outline buttons use (--focus-outline-* tokens), so focus is clearly visible (WCAG 2.4.7).
    'text-input': {base: {':focus-within': {outline: 'var(--focus-outline-width) var(--focus-outline-style) var(--focus-outline-color)', outlineOffset: '2px'}}},
    'text-area': {base: {':focus-within': {outline: 'var(--focus-outline-width) var(--focus-outline-style) var(--focus-outline-color)', outlineOffset: '2px'}}},
    'date-input': {base: {':focus-within': {outline: 'var(--focus-outline-width) var(--focus-outline-style) var(--focus-outline-color)', outlineOffset: '2px'}}},
    selector: {base: {':focus-within': {outline: 'var(--focus-outline-width) var(--focus-outline-style) var(--focus-outline-color)', outlineOffset: '2px'}}},
  },
});
