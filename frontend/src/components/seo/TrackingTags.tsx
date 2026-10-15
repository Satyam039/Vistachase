import Script from "next/script";
import type { SiteConfig } from "@/lib/seo/server";

// The Google tag (gtag.js), rendered only when an admin has switched tracking on in the SEO portal
// (Settings → Approvals). One loader for the whole site, then one `config` per ID (GA4 and Google
// Ads share the loader), so no tag is loaded twice. With consent "denied" by default, Google's
// consent mode keeps storage off until a consent banner grants it. No conversion events are sent
// here: which buttons count as conversions is still to be confirmed with the site owner.

const GA4 = /^G-[A-Z0-9]{4,20}$/;
const ADS = /^AW-\d{6,15}$/;

export function TrackingTags({ tracking }: { tracking: SiteConfig["tracking"] }) {
  if (!tracking) return null;
  const ids = [tracking.ga4Id, tracking.adsId].filter((id): id is string => !!id && (GA4.test(id) || ADS.test(id)));
  if (ids.length === 0) return null;
  const consent =
    tracking.consentDefault === "denied"
      ? "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});"
      : "";
  const init = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}${consent}gtag('js',new Date());${ids.map((id) => `gtag('config',${JSON.stringify(id)});`).join("")}`;
  return (
    <>
      <Script id="vc-gtag-loader" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids[0])}`} strategy="afterInteractive" />
      <Script id="vc-gtag-init" strategy="afterInteractive">
        {init}
      </Script>
    </>
  );
}
