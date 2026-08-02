"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { listDocsArticles } from "@/lib/docs/articles";
import { DOCS_SECTIONS } from "@/lib/docs/sections";
import { cn } from "@/lib/utils";

/**
 * Public documentation chrome — void canvas, ink sidebar, article column.
 */
export function DocsShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-svh bg-void-black text-pure-white">
      <header className="sticky top-0 z-40 border-b border-slate/80 bg-ink/85 backdrop-blur-[18px]">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.18em] uppercase"
          >
            <span className="text-coral-pulse" aria-hidden>
              ◆
            </span>
            Badger
          </Link>
          <span className="text-eyebrow text-ash">Docs</span>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/overview"
              className="hidden text-[13px] font-medium text-ash transition-colors hover:text-pure-white sm:inline"
            >
              Dashboard
            </Link>
            <Link
              href="/login"
              className="inline-flex h-8 items-center rounded-md bg-mist px-3 text-[13px] font-medium text-iron hover:bg-pure-white"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-10">
        <DocsSidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function DocsSidebar() {
  const pathname = usePathname();
  const articles = listDocsArticles();

  return (
    <nav aria-label="Documentation" className="lg:sticky lg:top-20 lg:self-start">
      <Link
        href="/docs"
        className={cn(
          "mb-4 block rounded-md px-2.5 py-2 text-[13px] font-medium transition-machine",
          pathname === "/docs"
            ? "row-active text-pure-white"
            : "text-ash hover:bg-obsidian/60 hover:text-pure-white",
        )}
      >
        Docs home
      </Link>
      {DOCS_SECTIONS.map((section) => {
        const items = articles.filter((article) => article.section === section.id);
        if (items.length === 0) {
          return null;
        }
        return (
          <div key={section.id} className="mb-5">
            <p className="px-2.5 text-eyebrow">{section.title}</p>
            <ul className="mt-2 space-y-0.5">
              {items.map((article) => {
                const href = `/docs/${article.slug}`;
                const active = pathname === href;
                return (
                  <li key={article.slug}>
                    <Link
                      href={href}
                      className={cn(
                        "block rounded-md px-2.5 py-1.5 text-[13px] transition-machine",
                        active
                          ? "row-active text-pure-white"
                          : "text-ash hover:bg-obsidian/60 hover:text-pure-white",
                      )}
                    >
                      {article.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
