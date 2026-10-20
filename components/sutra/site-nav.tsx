import Link from "next/link";
import Image from "next/image";

export function SiteNav({
  active,
}: {
  active?: "home" | "workbench" | "demo" | "how";
}) {
  const links = [
    {
      href: "/workbench",
      label: "Recovery workbench",
      key: "workbench" as const,
    },
    { href: "/demo", label: "Guided demo", key: "demo" as const },
    { href: "/how-it-works", label: "How it works", key: "how" as const },
  ];

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-5">
        {/* Sutra brand */}
{/* Sutra logo and wordmark */}
<Link
  href="/"
  aria-label="Sutra home"
  className="group flex shrink-0 items-center gap-3 font-display text-2xl font-bold tracking-tight text-ink"
>
  <span className="relative grid size-11 shrink-0 place-items-center rounded-full border border-green-bright/50 bg-[#0b2226] shadow-[0_0_12px_rgba(84,201,139,0.22),inset_0_0_8px_rgba(84,201,139,0.08)] transition-all duration-300 group-hover:border-green-bright group-hover:shadow-[0_0_22px_rgba(84,201,139,0.4)]">
    <Image
      src="/favicon_io/favicon-32x32.png"
      alt=""
      aria-hidden="true"
      width={40}
      height={40}
      priority
      className="size-9 rounded-full object-contain"
    />
  </span>

  <span className="transition-colors duration-200 group-hover:text-green-bright">
    Sutra
  </span>
</Link>
        {/* Desktop navigation */}
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-1 text-sm md:flex"
        >
          {links.map((link) => {
            const isActive = active === link.key;

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-xl px-3.5 py-2 transition-colors duration-200 ${
                  isActive
                    ? "bg-green-soft text-green-bright"
                    : "text-ink2 hover:bg-white/5 hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile navigation */}
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink transition hover:border-green/40 hover:text-green-bright [&::-webkit-details-marker]:hidden">
            Menu
          </summary>

          <nav
            aria-label="Mobile navigation"
            className="absolute right-0 mt-3 grid min-w-52 gap-1 rounded-2xl border border-white/10 bg-[#0b2226]/95 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
          >
            {links.map((link) => {
              const isActive = active === link.key;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-green-soft text-green-bright"
                      : "text-ink2 hover:bg-white/5 hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </details>
      </div>
    </header>
  );
}
