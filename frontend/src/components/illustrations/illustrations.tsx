import { Illustration, type IllustrationProps } from "./Illustration";

/** Shared mountain range used across the set so every illustration reads as one family. */
function Range({ y = 0 }: { y?: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <path d="M20 170 L78 92 L112 134 L150 74 L220 170 Z" className="fill-gray-subtle" />
      <path d="M150 74 L165 94 L156 92 L148 100 L140 90 Z" className="fill-surface" />
      <path d="M78 92 L90 108 L82 106 L76 112 L70 103 Z" className="fill-surface" />
      <path d="M40 170 L96 118 L130 150 L160 124 L206 170 Z" className="fill-border-strong" />
    </g>
  );
}

/** Zero search results: a mountain range under a magnifying glass. */
export function NoResultsIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="120" cy="120" r="104" className="fill-muted" />
      <circle cx="150" cy="70" r="16" className="fill-yellow-subtle" />
      <Range />
      <rect x="20" y="168" width="200" height="6" rx="3" className="fill-gray-ring" />
      <circle cx="98" cy="112" r="34" className="fill-surface stroke-primary" strokeWidth="8" />
      <path d="M122 136 L150 164" className="stroke-primary" strokeWidth="10" strokeLinecap="round" />
      <path d="M86 112 h24" className="stroke-border-strong" strokeWidth="6" strokeLinecap="round" />
    </Illustration>
  );
}

/** No booked trips yet: an empty boarding pass with a mountain stamp. */
export function NoTripsIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="120" cy="120" r="104" className="fill-muted" />
      <rect x="44" y="70" width="152" height="100" rx="14" className="fill-card stroke-border-strong" strokeWidth="4" />
      <path d="M150 74 V166" className="stroke-border-strong" strokeWidth="4" strokeDasharray="6 8" />
      <path d="M62 140 L84 112 L96 126 L110 108 L130 140 Z" className="fill-blue-subtle stroke-blue-ring" strokeWidth="3" strokeLinejoin="round" />
      <rect x="62" y="88" width="56" height="8" rx="4" className="fill-gray-subtle" />
      <rect x="62" y="150" width="40" height="8" rx="4" className="fill-gray-subtle" />
      <circle cx="173" cy="104" r="10" className="fill-gray-subtle" />
      <rect x="163" y="126" width="20" height="8" rx="4" className="fill-gray-subtle" />
      <rect x="163" y="142" width="20" height="8" rx="4" className="fill-gray-subtle" />
    </Illustration>
  );
}

/** Page not found: a trail signpost with a question mark. */
export function NotFoundIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="120" cy="120" r="104" className="fill-muted" />
      <Range y={6} />
      <rect x="114" y="74" width="12" height="112" rx="4" className="fill-orange-ring" />
      <path d="M70 80 H160 L176 96 L160 112 H70 Z" className="fill-orange-subtle stroke-orange-vivid" strokeWidth="4" strokeLinejoin="round" />
      <path
        d="M110 88 c0-7 5-10 10-10 s10 3 10 9 c0 6-10 7-10 13"
        className="stroke-orange-vivid"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="120" cy="106" r="3" className="fill-orange-vivid" />
      <ellipse cx="120" cy="186" rx="40" ry="6" className="fill-gray-ring" />
    </Illustration>
  );
}

/** Something went wrong / service unavailable: a storm cloud over the peaks. */
export function ErrorStateIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="120" cy="120" r="104" className="fill-muted" />
      <Range y={10} />
      <path
        d="M70 96 a24 24 0 0 1 22-30 a32 32 0 0 1 60 4 a22 22 0 0 1 18 26 Z"
        className="fill-surface stroke-border-strong"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M118 100 L108 120 H122 L112 142" className="stroke-warning" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </Illustration>
  );
}

/** Welcome / onboarding: sunrise over a mountain lake. */
export function WelcomeIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="120" cy="120" r="104" className="fill-muted" />
      <circle cx="120" cy="118" r="30" className="fill-yellow-subtle stroke-yellow-ring" strokeWidth="4" />
      <Range y={-10} />
      <path d="M24 160 H216 V176 a96 40 0 0 1 -192 0 Z" className="fill-blue-subtle" />
      <path d="M70 172 h40 M130 172 h40 M96 186 h48" className="stroke-blue-ring" strokeWidth="4" strokeLinecap="round" />
    </Illustration>
  );
}
