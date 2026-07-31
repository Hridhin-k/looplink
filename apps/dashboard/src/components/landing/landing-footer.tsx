import Link from "next/link";

/**
 * Marketing footer.
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-ash-stroke/40 bg-obsidian-canvas py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:gap-8">
        <div>
          <p className="font-mono text-[12px] tracking-[0.18em] text-bone uppercase">Badger</p>
          <p className="mt-3 max-w-xs text-sm text-warm-granite">
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
            { label: "Start project", href: "/login" },
            { label: "Workspace", href: "/workspace" },
            { label: "Requests", href: "/requests" },
          ]}
        />
      </div>

      <div className="mx-auto mt-16 flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <p className="text-sm text-warm-granite">© {new Date().getFullYear()} Badger</p>
        <Link href="/login" className="text-sm text-warm-granite transition-colors hover:text-bone">
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
      <p className="font-mono text-[12px] tracking-[-0.02em] text-bone uppercase">{title}</p>
      <ul className="mt-4 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-warm-granite transition-colors duration-150 hover:text-bone"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
