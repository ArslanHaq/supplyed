"use client";

import { RouteErrorState } from "@/components/molecules/RouteErrorState";

export default function AuthError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorState
      description="The account flow hit a rendering problem. Retry the step or return home."
      eyebrow="Auth flow error"
      reset={reset}
      title="We could not load this account step."
    />
  );
}
