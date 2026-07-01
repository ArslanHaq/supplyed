"use client";

import { RouteErrorState } from "@/components/molecules/RouteErrorState";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorState
      description="The workspace route could not render. Retry without losing the global app shell."
      eyebrow="Workspace error"
      reset={reset}
      title="We could not load this workspace."
    />
  );
}
