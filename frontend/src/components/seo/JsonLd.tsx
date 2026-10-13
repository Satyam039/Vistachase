// Structured data for search engines. "<" is escaped so text from the database can never close
// the script element. Only describe what the page visibly shows.

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export interface Crumb {
  name: string;
  /** Site path such as "/shared-tours"; the last crumb (the page itself) may omit it. */
  path?: string;
}

/** BreadcrumbList matching the breadcrumb shown on the page. `origin` makes the URLs absolute. */
export function BreadcrumbJsonLd({ origin, items }: { origin: string; items: Crumb[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          ...(item.path ? { item: `${origin}${item.path}` } : {}),
        })),
      }}
    />
  );
}
