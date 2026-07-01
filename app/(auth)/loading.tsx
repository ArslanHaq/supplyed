import { AuthFlowLoader } from "@/components/molecules/Loaders";

export default function AuthLoading() {
  return (
    <AuthFlowLoader
      description="Preparing the secure account flow."
      title="Loading secure access"
    />
  );
}
