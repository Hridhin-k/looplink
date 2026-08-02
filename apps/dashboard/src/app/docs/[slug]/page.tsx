import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsArticleView } from "@/components/docs/docs-article-view";
import { getDocsArticle } from "@/lib/docs/articles";
import { listDocsManifest } from "@/lib/docs/manifest";

interface DocsSlugPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export function generateStaticParams(): { slug: string }[] {
  return listDocsManifest().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: DocsSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getDocsArticle(slug);
  if (article === undefined) {
    return { title: "Docs · Badger" };
  }
  return {
    title: `${article.title} · Badger Docs`,
    description: article.description,
  };
}

export default async function DocsSlugPage({ params }: DocsSlugPageProps) {
  const { slug } = await params;
  const article = getDocsArticle(slug);
  if (article === undefined) {
    notFound();
  }
  return <DocsArticleView article={article} />;
}
