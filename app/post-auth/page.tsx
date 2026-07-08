import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PostAuthRedirectClient } from "@/components/organisms/PostAuthRedirectClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Preparing account");

export default async function PostAuthPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <PostAuthRedirectClient
      sessionUser={{
        applicationStatus: session.user.applicationStatus,
        email: session.user.email ?? "",
        emailVerified: session.user.isEmailVerified,
        role: session.user.role,
      }}
    />
  );
}
