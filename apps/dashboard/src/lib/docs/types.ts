import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface DocsArticleMeta {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly order: number;
  readonly section: DocsSectionId;
  readonly icon?: LucideIcon;
}

export type DocsSectionId =
  | "start"
  | "product"
  | "collaborate"
  | "reference";

export interface DocsSection {
  readonly id: DocsSectionId;
  readonly title: string;
}

export interface DocsArticle extends DocsArticleMeta {
  readonly body: ReactNode;
}
