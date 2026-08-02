import type { DocsSection, DocsSectionId } from "@/lib/docs/types";

export const DOCS_SECTIONS: readonly DocsSection[] = [
  { id: "start", title: "Get started" },
  { id: "product", title: "Product" },
  { id: "collaborate", title: "Collaborate" },
  { id: "reference", title: "Reference" },
] as const;

export const DOCS_SECTION_ORDER: readonly DocsSectionId[] = [
  "start",
  "product",
  "collaborate",
  "reference",
] as const;
