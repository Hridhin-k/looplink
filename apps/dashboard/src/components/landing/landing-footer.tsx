import Link from "next/link";

/**
 * Marketing footer — void canvas, ash links.
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-slate/60 bg-void-black py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:gap-8">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.18em] text-pure-white uppercase">
            <span className="text-coral-pulse" aria-hidden>
              ◆
            </span>
            Badger
          </p>
          <p className="mt-3 max-w-xs text-sm text-smoke">
            AI-native developer networking — tunnels, inspector, and workspace isolation.
          </p>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { label: "Overview", href: "#product" },
            { label: "Features", href: "#features" },
            { label: "CLI", href: "#start" },
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            { label: "Sign in", href: "/login" },
            { label: "Forgot password", href: "/forgot-password" },
            { label: "Dashboard", href: "/overview" },
          ]}
        />
        <FooterColumn
          title="Developers"
          links={[
            { label: "Documentation", href: "/docs" },
            { label: "Getting started", href: "/docs/getting-started" },
            { label: "CLI reference", href: "/docs/cli" },
            { label: "Workspace", href: "/workspace" },
            { label: "Requests", href: "/requests" },
          ]}
        />
      </div>

      <div className="mx-auto mt-16 flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <p className="text-sm text-smoke">© {new Date().getFullYear()} Badger</p>
        <Link
          href="/login"
          className="text-sm text-ash transition-colors hover:text-pure-white"
        >
          Sign in
        </Link>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  readonly title: string;
  readonly links: readonly { readonly label: string; readonly href: string }[];
}) {
  return (
    <div>
      <p className="text-eyebrow text-ash">{title}</p>
      <ul className="mt-4 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-smoke transition-colors duration-150 hover:text-pure-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
