/**
 * Vista Chase "VC" mark. A logo is a brand asset, so its gold/forest colors are fixed
 * rather than theme tokens; everything around it in the UI uses tokens.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Vista Chase">
      <defs>
        <linearGradient id="vc-mark-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dfb658" />
          <stop offset="1" stopColor="#a97b25" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#vc-mark-gold)" />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fontFamily="var(--font-montserrat), Montserrat, sans-serif"
        fontSize="17"
        fontWeight="700"
        fill="#04120e"
      >
        VC
      </text>
    </svg>
  );
}
