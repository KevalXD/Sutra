import Link from "next/link";

export function SiteNav({ active }: { active?: "home" | "workbench" | "demo" | "how" }) {
  const links = [
    { href: "/workbench", label: "Recovery workbench", key: "workbench" as const },
    { href: "/demo", label: "Guided demo", key: "demo" as const },
    { href: "/how-it-works", label: "How it works", key: "how" as const },
  ];
  return <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/90 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
    <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-ink" aria-label="Sutra home">Sutra</Link>
    <nav aria-label="Primary navigation" className="hidden items-center gap-1 text-sm md:flex">{links.map(link => <Link key={link.href} href={link.href} aria-current={active === link.key ? "page" : undefined} className={`rounded-lg px-3 py-2 transition ${active === link.key ? "bg-soft text-ink" : "text-muted hover:text-ink"}`}>{link.label}</Link>)}</nav>
    <details className="relative md:hidden"><summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-2 text-sm text-ink">Menu</summary><nav aria-label="Mobile navigation" className="absolute right-0 mt-2 grid min-w-52 gap-1 rounded-xl border border-line bg-surface p-2 shadow-l2">{links.map(link => <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm text-ink2 hover:bg-soft hover:text-ink">{link.label}</Link>)}</nav></details>
  </div></header>;
}
