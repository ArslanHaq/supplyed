"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/cn";
import { validateUkPostcode } from "@/lib/uk-validation";
import { resolvePostcodeLocation, type PostcodeArea } from "@/lib/postcode-location";
import { fetchJson } from "@/lib/query/fetch-json";
import { dropdownKey } from "@/features/dropdowns/use-dropdown";
import type { Dropdown } from "@/features/dropdowns/types";

import { Btn, Field } from "../atoms";

export type PostcodeLookupSelection = {
  city: string;
  countryCode: string;
  county: string;
  postcode: string;
};

type PostcodesIoResponse = {
  result?: PostcodeArea & {
    postcode?: string;
  } | null;
};

const unavailableMessage = "Postcode lookup is unavailable. You can still enter a valid UK postcode and select your town.";

async function lookupPostcodeArea(postcode: string): Promise<{ area: PostcodeArea; postcode: string } | { error: string }> {
  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`, {
    signal: AbortSignal.timeout(6000),
  });

  if (response.status === 404) return { error: "We couldn't find that postcode." };
  if (!response.ok) return { error: unavailableMessage };

  const payload = (await response.json()) as PostcodesIoResponse;

  const validated = validateUkPostcode(payload.result?.postcode, { required: true });
  if (!validated.valid || validated.value !== validateUkPostcode(postcode).value) return { error: unavailableMessage };
  return { area: payload.result!, postcode: validated.value };
}

export function PostcodeLookup({
  error,
  hint,
  id,
  label = "Postcode",
  onChange,
  onSelect,
  placeholder = "M5 4WT",
  required,
  value,
}: {
  error?: string;
  hint?: string;
  id: string;
  label?: string;
  onChange: (value: string) => void;
  onSelect: (selection: PostcodeLookupSelection) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [notice, setNotice] = useState("");
  // State updates land after a render, so a ref is what stops a second lookup
  // starting before the first one has set `pending`.
  const inFlight = useRef(false);
  const inputVersion = useRef(0);
  const lastLookup = useRef("");

  async function lookup() {
    if (inFlight.current) return;

    setLookupError("");
    setNotice("");

    const validated = validateUkPostcode(value, { required: true });
    if (!validated.valid) {
      setLookupError(validated.error!);
      return;
    }

    inFlight.current = true;
    const requestVersion = inputVersion.current;
    setPending(true);
    try {
      const [result, catalogues] = await Promise.all([
        lookupPostcodeArea(validated.value),
        Promise.allSettled(["city", "region"].map(name => queryClient.fetchQuery({
          queryKey: dropdownKey(name),
          queryFn: () => fetchJson<Dropdown>(`/api/dropdowns/${name}`),
          staleTime: 30_000,
        }))),
      ]);
      if (requestVersion !== inputVersion.current) return;

      if ("error" in result) {
        setLookupError(result.error);
        return;
      }

      const [cities, regions] = catalogues.map(result => result.status === "fulfilled" ? result.value.options : []);
      const selection = { ...resolvePostcodeLocation(result.area, cities, regions), postcode: result.postcode };
      onChange(selection.postcode);
      onSelect(selection);
      lastLookup.current = selection.postcode;
      setNotice(selection.city
        ? "Country and city filled from your postcode. Please check the details below."
        : "UK postcode found and country filled. Choose your city or town below; no matching city was available.");
    } catch {
      if (requestVersion === inputVersion.current) setLookupError(unavailableMessage);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const shownError = error || lookupError;

  return (
    <div className="min-w-0">
      <Field label={label} htmlFor={id} error={shownError} hint={notice || hint || "Enter a UK postcode to fill your country and city, then check the details below."} required={required}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-invalid={Boolean(shownError)}
            autoComplete="postal-code"
            className={cn("input min-w-0 flex-1", shownError ? "border-danger bg-danger-tint" : "")}
            id={id}
            maxLength={10}
            required={required}
            onBlur={() => {
              const result = validateUkPostcode(value, { required });
              setLookupError(result.error || "");
              if (result.valid && value) {
                onChange(result.value);
                if (lastLookup.current !== result.value) void lookup();
              }
            }}
            onChange={(event) => {
              onChange(event.target.value.toUpperCase());
              inputVersion.current += 1;
              if (lookupError) setLookupError(validateUkPostcode(event.target.value, { required }).error || "");
              setNotice("");
            }}
            onKeyDown={(event) => {
              // Enter looks the postcode up instead of submitting the surrounding form.
              // A held key repeats, so only the first press counts.
              if (event.key === "Enter") {
                event.preventDefault();
                if (!event.repeat) void lookup();
              }
            }}
            placeholder={placeholder}
            value={value}
          />
          <Btn
            className="shrink-0"
            disabled={!value.trim()}
            icon="search"
            loading={pending}
            loadingLabel="Finding"
            onClick={() => void lookup()}
            variant="secondary"
          >
            Check postcode
          </Btn>
        </div>
      </Field>
    </div>
  );
}
