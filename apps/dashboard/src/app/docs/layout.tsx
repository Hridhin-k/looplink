import type { ReactNode } from "react";

import { DocsShell } from "@/components/docs/docs-shell";
import { listDocsManifest } from "@/lib/docs/manifest";

export default function DocsLayout({ children }: { readonly children: ReactNode }) {
  return <DocsShell articles={listDocsManifest()}>{children}</DocsShell>;
}
