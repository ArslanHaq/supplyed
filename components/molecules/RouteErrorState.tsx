"use client";

import { Btn, Logo } from "@/components/atoms";

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

      <section className="mx-auto mt-16 max-w-[760px] rounded-xl border border-border bg-white p-6 shadow-(--shadow-xs) sm:p-9">
        <div className="eyebrow mb-4 text-brand">{eyebrow}</div>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-[560px] text-base leading-7 text-muted">{description}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Btn onClick={reset}>Retry</Btn>
          <Btn variant="secondary" onClick={() => window.location.assign("/")}>
            View Home
          </Btn>
        </div>
      </section>
    </main>
  );
}
