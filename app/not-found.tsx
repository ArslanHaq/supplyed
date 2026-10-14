import Link from "next/link";

import { buttonClassName, Icon, Logo } from "@/components/atoms";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-chalk px-4 py-6 sm:px-6 lg:px-12">
      <header className="flex min-h-12 items-center"><Logo href="/" size={20} /></header>
      <section className="mx-auto mt-12 max-w-[640px] rounded-xl border border-border bg-surface p-7 shadow-card sm:mt-20 sm:p-12">
        <span className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-brand/15 bg-brand-tint text-brand-dark"><Icon name="search" size={25} /></span>
        <p className="eyebrow mb-4">404</p>
        <h1 className="font-heading text-3xl leading-tight sm:text-4xl">Page not found</h1>
        <p className="mt-4 text-sm leading-7 text-muted">This page may have moved, or the link may be incomplete. You can return home or continue to your workspace.</p>
        <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
          <Link className={buttonClassName()} href="/">View home</Link>
          <Link className={buttonClassName({ variant: "secondary" })} href="/dashboard">Go to workspace</Link>
        </div>
      </section>
    </main>
  );
}
