// Google Ads + GA4 for the Google Ads launch (owner, 16 Nov 2026). The Shared Tours page loads the
// Google tag with these IDs; a finished booking sends the "Purchase" conversion the owner set up in
// Google Ads (a page-load conversion, sent when the guest sees "Booking confirmed").

export const GOOGLE_ADS_ID = "AW-16675422535";
export const GA4_ID = "G-KH1432E703";
export const ADS_PURCHASE_EVENT = "ads_conversion_Purchase_1";

type Gtag = (...args: unknown[]) => void;

/**
 * Sends the Google Ads purchase conversion once per booking. Checkout pages don't all carry the
 * Google tag, so this loads it here (with both IDs) when the page hasn't already. The booking
 * reference goes as transaction_id, which also lets Google drop a duplicate on its side.
 */
export function trackAdsPurchase({ transactionId, value, currency }: { transactionId: string; value: number; currency: string }) {
  if (typeof window === "undefined" || !transactionId) return;
  const key = `vc-ads-purchase:${transactionId}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: still send it; transaction_id keeps Google from counting it twice.
  }
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: Gtag };
  w.dataLayer = w.dataLayer || [];
  if (!w.gtag) {
    w.gtag = function gtag() {
      // gtag.js reads the Arguments object itself, as in Google's snippet.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  }
  const gtag = w.gtag;
  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    gtag("js", new Date());
    gtag("config", GOOGLE_ADS_ID);
    gtag("config", GA4_ID);
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
    document.head.appendChild(s);
  }
  gtag("event", ADS_PURCHASE_EVENT, {
    value: Math.round(value * 100) / 100,
    currency: currency || "CAD",
    transaction_id: transactionId,
  });
}
