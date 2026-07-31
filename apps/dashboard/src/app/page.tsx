import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Badger — Ship tunnels. Inspect everything.",
  description:
    "Public HTTPS for local servers with live request capture, replay, and workspace-scoped observability.",
};

/**
 * Public marketing landing at `/`. Authenticated product lives under `/overview`.
 */
export default function HomePage() {
  return <LandingPage />;
}
