import Link from "next/link";
import type { ReactNode } from "react";

import { listDocsArticles } from "@/lib/docs/articles";
import type { DocsArticle } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

/**
 * Article header + prose container for a docs page.
 */
export function DocsArticleView({
  article,
  children,
}: {
  readonly article: DocsArticle;
  readonly children?: ReactNode;
}) {
  const all = listDocsArticles();
  const index = all.findIndex((item) => item.slug === article.slug);
  const prev = index > 0 ? all[index - 1] : undefined;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : undefined;

  return (
    <article className="min-w-0">
      <p className="text-eyebrow">Documentation</p>
      <h1 className="mt-3 text-[32px] leading-[1.15] font-medium tracking-tight text-pure-white">
        {article.title}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-smoke">
        {article.description}
      </p>
      <div className="mt-8 border-t border-slate/70 pt-2">{children ?? article.body}</div>

      <nav
        aria-label="Adjacent guides"
        className="mt-12 grid gap-3 border-t border-slate/70 pt-6 sm:grid-cols-2"
      >
        <Adjacent href={prev ? `/docs/${prev.slug}` : undefined} label="Previous" title={prev?.title} />
        <Adjacent
          href={next ? `/docs/${next.slug}` : undefined}
          label="Next"
          title={next?.title}
          align="right"
        />
      </nav>
    </article>
  );
}

function Adjacent({
  href,
  label,
  title,
  align = "left",
}: {
  readonly href: string | undefined;
  readonly label: string;
  readonly title: string | undefined;
  readonly align?: "left" | "right";
}) {
  if (href === undefined || title === undefined) {
    return <div />;
  }
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg bg-ink p-4 shadow-hairline transition-machine hover:shadow-key",
        align === "right" && "text-right sm:justify-self-end sm:text-right",
      )}
    >
      <p className="text-eyebrow">{label}</p>
      <p className="mt-2 text-sm font-medium text-pure-white">{title}</p>
    </Link>
  );
}
