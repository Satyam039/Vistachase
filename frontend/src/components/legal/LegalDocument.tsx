// Layout for the legal pages (terms, privacy, cancellation): header with the title and a contents
// list, then numbered, readable sections; related policies at the end. Content is passed as data
// and is the wording of the live vistachase.com pages.

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type LegalBlock = string | { list: string[] } | { sub: string };
export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const RELATED = [
  { label: "Terms & conditions", href: "/terms-and-conditions" },
  { label: "Cancellation policy", href: "/cancellation-policy" },
  { label: "Privacy policy", href: "/privacy-policy" },
];

export function LegalDocument({ title, intro, sections, current }: { title: string; intro?: string; sections: LegalSection[]; current: string }) {
  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <section aria-label="Introduction" className="border-b border-obsidian-900/[0.06] bg-white">
        <div className="mx-auto max-w-5xl px-page pb-10 pt-10 text-center sm:pt-14">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
              <li>
                <Link href="/" className="hover:text-obsidian-900 hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-obsidian-900">
                {title}
              </li>
            </ol>
          </nav>
          <h1 className="text-4xl font-light tracking-tight text-obsidian-900 sm:text-5xl">{title}</h1>
          {intro && <p className="mx-auto mt-4 max-w-3xl text-lg font-light leading-relaxed text-slate-700">{intro}</p>}
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-page py-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-[calc(var(--vc-header-h,80px)+16px)] max-h-[calc(100vh-var(--vc-header-h,80px)-32px)] overflow-y-auto overscroll-contain pb-2 pr-2">
            <p className="mb-3 text-sm text-slate-600">On this page</p>
            <ol className="space-y-1.5 border-l border-obsidian-900/10 text-sm">
              {sections.map((s) => (
                <li key={s.title}>
                  <a href={`#${slug(s.title)}`} className="-ml-px block border-l border-transparent py-0.5 pl-4 text-slate-700 hover:border-ocean-600 hover:text-obsidian-900">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="space-y-10">
          {sections.map((s) => (
            <section key={s.title} id={slug(s.title)} aria-labelledby={`${slug(s.title)}-h`} className="scroll-mt-28">
              <h2 id={`${slug(s.title)}-h`} className="text-2xl font-light text-obsidian-900">
                {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-base leading-relaxed text-slate-700">
                {s.blocks.map((b, i) =>
                  typeof b === "string" ? (
                    <p key={i}>{b}</p>
                  ) : "list" in b ? (
                    <ul key={i} className="list-disc space-y-1.5 pl-6 marker:text-ocean-600">
                      {b.list.map((li) => (
                        <li key={li}>{li}</li>
                      ))}
                    </ul>
                  ) : (
                    <h3 key={i} className="pt-2 text-lg text-obsidian-900">
                      {b.sub}
                    </h3>
                  ),
                )}
              </div>
            </section>
          ))}

          <aside aria-label="Related policies" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
            <p className="text-base text-obsidian-900">Related policies</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {RELATED.filter((r) => r.href !== current).map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="inline-flex h-10 items-center rounded-full border border-obsidian-900/15 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50">
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-600">Questions? Email support@vistachase.com or call +1 825-734-9456.</p>
          </aside>
        </article>
      </div>
    </div>
  );
}
