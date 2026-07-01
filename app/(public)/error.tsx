"use client";

import { RouteErrorState } from "@/components/molecules/RouteErrorState";

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorState
      description="The public page could not render. Retry the segment or return home."
      eyebrow="Page error"
      reset={reset}
      title="We could not load this page."
    />
  );
}
