import type { Metadata } from "next";
import Link from "next/link";

import { listDocsArticles } from "@/lib/docs/articles";
import { DOCS_SECTIONS } from "@/lib/docs/sections";

export const metadata: Metadata = {
  title: "Docs · Badger",
  description: "A to Z production guide for Badger CLI, tunnels, and dashboard.",
};

export default function DocsHomePage() {
  const articles = listDocsArticles();

  return (
    <div>
      <p className="text-eyebrow">Documentation</p>
      <h1 className="mt-3 text-[36px] leading-[1.1] font-medium tracking-tight text-pure-white">
        How to use Badger
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-smoke">
        Production guides from install through replay, workspaces, and troubleshooting.
        Start with Getting started, then jump to any topic below.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/docs/getting-started"
          className="inline-flex h-9 items-center rounded-md bg-mist px-3 text-[13px] font-medium text-iron hover:bg-pure-white"
        >
          Start here
        </Link>
        <Link
          href="/docs/glossary"
          className="inline-flex h-9 items-center rounded-md border border-slate px-3 text-[13px] font-medium text-ash hover:border-ash hover:text-pure-white"
        >
          Glossary A–Z
        </Link>
      </div>

      <div className="mt-12 space-y-10">
        {DOCS_SECTIONS.map((section) => {
          const items = articles.filter((article) => article.section === section.id);
          if (items.length === 0) {
            return null;
          }
          return (
            <section key={section.id}>
              <h2 className="text-eyebrow">{section.title}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {items.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/docs/${article.slug}`}
                      className="block h-full rounded-lg bg-ink p-4 shadow-hairline transition-machine hover:shadow-key"
                    >
                      <p className="font-mono text-[11px] tracking-[0.04em] text-coral-pulse uppercase">
                        {String(article.order).padStart(2, "0")}
                      </p>
                      <p className="mt-2 text-[15px] font-medium text-pure-white">
                        {article.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-smoke">
                        {article.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
