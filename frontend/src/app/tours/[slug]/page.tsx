import { permanentRedirect } from "next/navigation";

// Old /tours/<slug> links: products live at their top-level vistachase.com URLs.
export default async function LegacyTourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/${encodeURIComponent(slug)}`);
}
