import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";
import type { SearchParamsPageProps } from "@/types/route";

export const metadata = noIndexMetadata("Job Detail");

export default async function JobDetailRoutePage({ searchParams }: SearchParamsPageProps) {
  const jobIdValue = (await searchParams)?.jobId;
  const jobId = Array.isArray(jobIdValue) ? jobIdValue[0] : jobIdValue;
  return <AppRouteShell page="job-detail" initialContext={jobId ? { jobId } : undefined} />;
}
