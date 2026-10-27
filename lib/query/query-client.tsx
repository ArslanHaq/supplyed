"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { refreshDropdownsAfterFailure } from "@/features/dropdowns/refresh";
import type { ReactNode } from "react";
import { useState } from "react";
import { recordRateLimit, useRateLimit } from "@/lib/rate-limit";
import { reportSchoolInactive } from "@/features/auth/use-school-hiring";

export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({ onSuccess: result => { recordRateLimit(result); reportSchoolInactive(result); refreshDropdownsAfterFailure(result); }, onError: error => { recordRateLimit(error); reportSchoolInactive(error); refreshDropdownsAfterFailure(error); } }),
        defaultOptions: {
          mutations: {
            retry: 0,
          },
          queries: {
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (count, error) => (error as { status?: number }).status !== 429 && count < 1,
            staleTime: 30 * 1000,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}><RateLimitNotice />{children}</QueryClientProvider>;
}

function RateLimitNotice() {
  const seconds = useRateLimit();
  return seconds ? <div role="status" className="fixed inset-x-0 top-0 z-[10000] bg-warning-tint px-4 py-3 text-center text-sm text-ink">Too many attempts. Try again in {seconds} seconds.</div> : null;
}
