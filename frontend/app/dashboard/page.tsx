"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/sutra/auth-shell";

type User = { fullName: string; email: string };
export default function DashboardPage() {
  const [user, setUser] = useState<User>();
  const [error, setError] = useState<string>();
  const base = process.env.NEXT_PUBLIC_API_BASE;
  useEffect(() => {
    if (!base) { setError("Authentication service configuration is missing."); return; }
    fetch(new URL("/v1/auth/me", base), { credentials: "include", cache: "no-store" }).then(async response => {
      if (response.status === 401) { window.location.assign("/login"); return; }
      const payload = await response.json() as { user?: User; error?: { message?: string } };
      if (!response.ok || !payload.user) throw new Error(payload.error?.message ?? "Could not restore your session.");
      setUser(payload.user);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Could not restore your session."));
  }, [base]);
  async function signOut() { if (base) await fetch(new URL("/v1/auth/logout", base), { method: "POST", credentials: "include" }); window.location.assign("/"); }
  return <AuthShell><main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-24 md:px-8"><section className="sutra-card w-full max-w-2xl rounded-[18px] border border-line bg-surface/90 p-6 shadow-l3 backdrop-blur md:p-8" aria-labelledby="dashboard-title"><p className="font-mono text-[12px] uppercase tracking-[0.18em] text-green-bright">Traveler workspace</p><h1 id="dashboard-title" className="mt-3 font-display text-[clamp(2rem,5vw,3rem)] font-semibold leading-none tracking-tight text-ink">{user ? `Welcome, ${user.fullName}` : "Restoring your session…"}</h1>{error ? <p role="alert" className="mt-6 rounded-[10px] border border-danger/40 bg-danger/10 p-3 text-[14px] text-danger">{error}</p> : user && <><p className="mt-4 text-ink2">{user.email}</p><p className="mt-8 rounded-[10px] border border-line bg-bg p-4 text-[15px] text-ink2">Your account is ready. Journey ownership and persistent recovery history will appear when traveler trip storage is enabled. The public synthetic recovery demo remains available now.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/" className="rounded-[10px] bg-green px-5 py-2.5 text-[15px] font-medium text-bg hover:bg-green-bright">Open recovery workspace</Link><button type="button" onClick={signOut} className="rounded-[10px] border border-line-strong px-5 py-2.5 text-[15px] text-ink2 hover:bg-soft hover:text-ink">Log out</button></div></>}</section></main></AuthShell>;
}
