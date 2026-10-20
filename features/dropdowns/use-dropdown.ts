"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchJson } from "@/lib/query/fetch-json";
import type { Dropdown, DropdownName } from "./types";
export const dropdownKey = (name: string) => ["dropdown", name] as const;
export function useDropdown(name: DropdownName) {
  const query = useQuery({ queryKey: dropdownKey(name), queryFn: () => fetchJson<Dropdown>(`/api/dropdowns/${name}`), staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: "always", retry: 1 });
  const refetch = query.refetch;
  useEffect(() => {
    // Several fields may observe one collection; share the in-flight refresh.
    const refresh = () => { void refetch({ cancelRefetch: false }); };
    window.addEventListener("supplyed:refresh-dropdowns", refresh);
    return () => window.removeEventListener("supplyed:refresh-dropdowns", refresh);
  }, [refetch]);
  return query;
}
