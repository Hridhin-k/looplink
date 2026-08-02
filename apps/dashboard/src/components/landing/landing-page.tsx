import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingTrustStrip } from "@/components/landing/landing-trust-strip";

/**
 * Public marketing home — Lumen void canvas, Badger product narrative.
 */
export function LandingPage() {
  return (
    <div className="min-h-svh bg-void-black text-pure-white">
      <LandingNav />
      <main>
        <div id="product">
          <LandingHero />
        </div>
        <LandingTrustStrip />
        <LandingFeatures />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
