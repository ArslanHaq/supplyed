import { PageLoader } from "@/components/molecules/Loaders";

export default function WorkspaceLoading() {
  return (
    <PageLoader
      description="Restoring workspace state, selected role, and the current app view."
      title="Loading workspace"
    />
  );
}
