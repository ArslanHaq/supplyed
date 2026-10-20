"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { refreshDropdownsAfterFailure } from "@/features/dropdowns/refresh";
import type { ReactNode } from "react";
import { useState } from "react";

export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({ onSuccess: refreshDropdownsAfterFailure, onError: refreshDropdownsAfterFailure }),
        defaultOptions: {
          mutations: {
            retry: 0,
          },
          queries: {
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30 * 1000,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
