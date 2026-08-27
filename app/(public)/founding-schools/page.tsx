import type { Metadata } from "next";

import { FoundingInterestPage } from "@/components/organisms/FoundingInterestPage";
import { siteConfig } from "@/lib/seo";

type FoundingSchoolsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const description =
  "Join the SupplyED founding schools programme and help shape a compliance-first marketplace for verified supply teachers.";

export const metadata: Metadata = {
  title: "Founding Schools Programme",
  description,
  alternates: {
    canonical: "/founding-schools",
  },
  openGraph: {
    url: "/founding-schools",
    title: `Founding Schools Programme | ${siteConfig.name}`,
    description,
  },
  twitter: {
    title: `Founding Schools Programme | ${siteConfig.name}`,
    description,
  },
};

function firstQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanAttribution(value: string | undefined, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

export default async function FoundingSchoolsPage({ searchParams }: FoundingSchoolsPageProps) {
  const params = await searchParams;

  return (
    <FoundingInterestPage
      campaign={cleanAttribution(firstQueryParam(params?.campaign), 120)}
      source={cleanAttribution(firstQueryParam(params?.source), 80)}
      type="SCHOOL"
    />
  );
}
