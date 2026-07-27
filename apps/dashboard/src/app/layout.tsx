import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

/**
 * Root document metadata for the Badger dashboard shell.
 */
export const metadata: Metadata = {
  title: "Badger Dashboard",
  description: "Observe Badger tunnels through the server's public APIs.",
};

/**
 * Root layout for the App Router.
 *
 * Intentionally minimal: Phase 2 UI screens are not implemented yet.
 *
 * @param props - Layout children from Next.js.
 * @returns The HTML document shell.
 */
export default function RootLayout(props: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  );
}
