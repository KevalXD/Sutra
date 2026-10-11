"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

type AuthMode = "login" | "signup";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const signup = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("fullName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (signup && name.length < 2) return setMessage("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMessage("Enter a valid email address.");
    if (password.length < 8) return setMessage("Password must be at least 8 characters.");
    const base = process.env.NEXT_PUBLIC_API_BASE;
    if (!base) return setMessage("Authentication service configuration is missing.");
    setBusy(true);
    try {
      const response = await fetch(new URL(`/v1/auth/${mode}`, base), { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(signup ? { fullName: name, email, password } : { email, password }) });
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message ?? "Authentication failed. Try again.");
      window.location.assign("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-24 md:px-8">
      <section className="sutra-card w-full max-w-md rounded-[18px] border border-line bg-surface/90 p-6 shadow-l3 backdrop-blur md:p-8" aria-labelledby="auth-title">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-muted transition hover:text-ink focus-visible:text-ink">
          <ArrowLeft aria-hidden className="size-4" /> Back to journey
        </Link>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-green-bright">Sutra access</p>
        <h1 id="auth-title" className="mt-3 font-display text-[clamp(2rem,5vw,3rem)] font-semibold leading-none tracking-tight text-ink">{signup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-4 text-[15px] text-ink2">{signup ? "Save your journeys and return to recovery when you need it." : "Continue to your Sutra recovery workspace."}</p>
        <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
          {signup && <div><label htmlFor="fullName" className="mb-2 block text-[14px] text-ink2">Full name</label><input id="fullName" name="fullName" autoComplete="name" required className="w-full rounded-[10px] border border-line-strong bg-bg px-3 py-2.5 text-ink placeholder:text-muted focus:border-green" /></div>}
          <div><label htmlFor="email" className="mb-2 block text-[14px] text-ink2">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-[10px] border border-line-strong bg-bg px-3 py-2.5 text-ink placeholder:text-muted focus:border-green" /></div>
          <div><label htmlFor="password" className="mb-2 block text-[14px] text-ink2">Password</label><div className="relative"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} required minLength={8} className="w-full rounded-[10px] border border-line-strong bg-bg px-3 py-2.5 pr-11 text-ink placeholder:text-muted focus:border-green" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted hover:text-ink">{showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}</button></div></div>
          <button type="submit" disabled={busy} className="w-full rounded-[10px] bg-green px-5 py-2.5 text-[15px] font-medium text-bg transition hover:bg-green-bright disabled:cursor-wait disabled:opacity-60">{busy ? "Checking…" : signup ? "Create account" : "Sign in"}</button>
          {message && <p role="alert" aria-live="polite" className="rounded-[10px] border border-warn/40 bg-warn/10 p-3 text-[14px] text-warn">{message}</p>}
        </form>
        <p className="mt-6 text-center text-[14px] text-muted">{signup ? "Already have an account?" : "New to Sutra?"} <Link href={signup ? "/login" : "/signup"} className="text-green-bright underline-offset-4 hover:underline">{signup ? "Sign in" : "Create an account"}</Link></p>
      </section>
    </main>
  );
}
