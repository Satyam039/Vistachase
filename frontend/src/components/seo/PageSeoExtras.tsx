import Script from "next/script";
import { JsonLd } from "@/components/seo/JsonLd";
import { seoFetch } from "@/lib/seo/server";

// A published page's extras from the SEO portal's page settings: its JSON-LD blocks (Schema markup)
// and its custom code ("Inside <head>" and "Before </body>"). The backend only returns code it has
// parsed into a short list of allowed tags (scripts, noscript, style, meta, link), saved by an admin,
// so nothing here renders a raw string from the database as markup except those vetted elements.
// <meta> and <link> are hoisted into <head> by React; scripts load after the page becomes
// interactive. Cached for a minute like the rest of the SEO data; renders nothing when the backend
// is down or the page has nothing set.

type Attrs = Record<string, string | true>;
type CodeElement =
  | { tag: "script"; attrs: Attrs; content: string }
  | { tag: "noscript"; content: string }
  | { tag: "style"; content: string }
  | { tag: "meta"; attrs: Record<string, string> }
  | { tag: "link"; attrs: Record<string, string> };

interface Extras {
  schema: Record<string, unknown>[];
  head: CodeElement[];
  body: CodeElement[];
}

const SCRIPT_ATTRS = ["type", "async", "defer", "crossorigin", "integrity", "referrerpolicy", "nomodule"];

function scriptProps(attrs: Attrs) {
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (SCRIPT_ATTRS.includes(k) || k.startsWith("data-")) out[k === "crossorigin" ? "crossOrigin" : k === "referrerpolicy" ? "referrerPolicy" : k === "nomodule" ? "noModule" : k] = v === true ? true : v;
  }
  return out;
}

function CodeElements({ elements, where }: { elements: CodeElement[]; where: "head" | "body" }) {
  return (
    <>
      {elements.map((el, i) => {
        const key = `${where}-${i}`;
        switch (el.tag) {
          case "meta":
            return <meta key={key} {...(el.attrs.name ? { name: el.attrs.name } : { property: el.attrs.property })} content={el.attrs.content} />;
          case "link": {
            const { crossorigin, hreflang, ...rest } = el.attrs;
            return <link key={key} {...rest} {...(crossorigin !== undefined ? { crossOrigin: crossorigin as "anonymous" | "use-credentials" } : {})} {...(hreflang ? { hrefLang: hreflang } : {})} />;
          }
          case "style":
            return <style key={key} dangerouslySetInnerHTML={{ __html: el.content }} />;
          case "noscript":
            return <noscript key={key} dangerouslySetInnerHTML={{ __html: el.content }} />;
          case "script": {
            const type = typeof el.attrs.type === "string" ? el.attrs.type.toLowerCase() : "";
            if (type === "application/ld+json") {
              try {
                return <JsonLd key={key} data={JSON.parse(el.content)} />;
              } catch {
                return null;
              }
            }
            const props = scriptProps(el.attrs);
            if (typeof el.attrs.src === "string") return <Script key={key} id={`vc-code-${key}`} src={el.attrs.src} strategy="afterInteractive" {...props} />;
            return (
              <Script key={key} id={`vc-code-${key}`} strategy="afterInteractive" {...props}>
                {el.content}
              </Script>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}

/** Renders the page's managed JSON-LD and custom code. `schema={false}` where the page already renders its blocks. */
export async function PageSeoExtras({ path, schema = true }: { path: string; schema?: boolean }) {
  const res = await seoFetch<{ extras: Extras | null }>(`/page-extras?path=${encodeURIComponent(path)}`);
  const extras = res?.extras;
  if (!extras) return null;
  return (
    <>
      {schema && extras.schema.map((b, i) => <JsonLd key={`schema-${i}`} data={b} />)}
      <CodeElements elements={extras.head} where="head" />
      <CodeElements elements={extras.body} where="body" />
    </>
  );
}
