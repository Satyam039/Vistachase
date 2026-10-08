import { permanentRedirect } from "next/navigation";

// The live site's cancellation policy lived at this URL; keep old links working.
export default function LegacyCancellationPolicy() {
  permanentRedirect("/cancellation-policy");
}
