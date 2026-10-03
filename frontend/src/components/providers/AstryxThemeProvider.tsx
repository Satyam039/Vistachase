"use client";

import NextLink from "next/link";
import { Theme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import { stoneTheme } from "@/themes/stone/stone";

// The theme object carries React icon components, so it can't cross the
// server/client boundary as a prop; the root layout renders this wrapper instead.
export function AstryxThemeProvider({ children }: { children: React.ReactNode }) {
  // The existing site is designed light-only, so pin Astryx to light mode for now.
  // LinkProvider routes every Astryx link (nav items, buttons with href, Link) through
  // next/link so navigation stays client-side.
  return (
    <Theme theme={stoneTheme} mode="light">
      <LinkProvider component={NextLink}>{children}</LinkProvider>
    </Theme>
  );
}
