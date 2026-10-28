import { permanentRedirect } from "next/navigation";

// The cancellation policy lives at its Webflow URL, /privacy-policy-vista-chase.
export default function CancellationPolicyShortLink() {
  permanentRedirect("/privacy-policy-vista-chase");
}
