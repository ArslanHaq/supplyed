import type { Metadata } from "next";

import { FoundingInterestPage } from "@/components/organisms/FoundingInterestPage";
import { siteConfig } from "@/lib/seo";

type FoundingTeachersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const description =
  "Register interest as a founding SupplyED teacher and get early access to direct school opportunities before launch.";

export const metadata: Metadata = {
  title: "Founding Teachers Programme",
  description,
  alternates: {
    canonical: "/founding-teachers",
  },
  openGraph: {
    url: "/founding-teachers",
    title: `Founding Teachers Programme | ${siteConfig.name}`,
    description,
  },
  twitter: {
    title: `Founding Teachers Programme | ${siteConfig.name}`,
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

export default async function FoundingTeachersPage({ searchParams }: FoundingTeachersPageProps) {
  const params = await searchParams;

  return (
    <FoundingInterestPage
      campaign={cleanAttribution(firstQueryParam(params?.campaign), 120)}
      source={cleanAttribution(firstQueryParam(params?.source), 80)}
      type="TEACHER"
    />
  );
}
