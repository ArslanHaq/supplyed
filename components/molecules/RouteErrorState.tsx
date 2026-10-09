"use client";

import { Btn, Icon, Logo } from "@/components/atoms";

type RouteErrorStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  reset: () => void;
};

export function RouteErrorState({ eyebrow, title, description, reset }: RouteErrorStateProps) {
  return (
    <main className="min-h-screen bg-chalk px-4 py-6 sm:px-6 lg:px-12">
      <header className="flex min-h-12 items-center justify-between">
        <Logo href="/" size={20} />
        <Btn variant="secondary" onClick={reset}>
          Try again
        </Btn>
      </header>

      <section className="mx-auto mt-12 max-w-[640px] rounded-xl border border-border bg-white p-7 shadow-card sm:mt-20 sm:p-12">
        <span className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-brand/15 bg-brand-tint text-brand-dark"><Icon name="help" size={25} /></span>
        <div className="eyebrow mb-4 text-brand">{eyebrow}</div>
        <h1 className="font-heading text-3xl leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-[560px] text-sm leading-7 text-muted">{description}</p>
        <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
          <Btn icon="arrow" onClick={reset}>Try again</Btn>
          <Btn icon="home" variant="secondary" onClick={() => window.location.assign("/")}>
            View Home
          </Btn>
        </div>
      </section>
    </main>
  );
}
