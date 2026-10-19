import Link from "next/link";

export function SiteNav({ active }: { active?: "home" | "workbench" | "demo" | "how" }) {
  const links = [
    { href: "/workbench", label: "Recovery workbench", key: "workbench" as const },
    { href: "/demo", label: "Guided demo", key: "demo" as const },
    { href: "/how-it-works", label: "How it works", key: "how" as const },
  ];
  return <header className="sticky top-0 z-40 px-3 pt-3 md:px-5"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl border border-white/10 bg-surface/75 px-4 py-3 shadow-l2 backdrop-blur-xl md:px-5">
    <Link href="/" className="group flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight text-ink" aria-label="Sutra home"><span aria-hidden className="grid size-7 place-items-center rounded-lg border border-green/40 bg-green-soft text-sm text-green-bright shadow-[0_0_18px_rgba(84,201,139,0.2)]">✦</span><span className="transition group-hover:text-green-bright">Sutra</span></Link>
    <nav aria-label="Primary navigation" className="hidden items-center gap-1 text-sm md:flex">{links.map(link => <Link key={link.href} href={link.href} aria-current={active === link.key ? "page" : undefined} className={`rounded-xl px-3.5 py-2 transition ${active === link.key ? "bg-green-soft text-green-bright shadow-[inset_0_0_0_1px_rgba(84,201,139,0.18)]" : "text-muted hover:bg-white/5 hover:text-ink"}`}>{link.label}</Link>)}</nav>
    <details className="relative md:hidden"><summary className="cursor-pointer list-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink transition hover:border-green/40 hover:text-green-bright">Menu</summary><nav aria-label="Mobile navigation" className="absolute right-0 mt-3 grid min-w-52 gap-1 rounded-2xl border border-white/10 bg-surface p-2 shadow-l2 backdrop-blur-xl">{links.map(link => <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2.5 text-sm text-ink2 transition hover:bg-soft hover:text-ink">{link.label}</Link>)}</nav></details>
  </div></header>;
}
