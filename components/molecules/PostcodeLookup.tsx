"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { formatUkPostcode, isValidUkPostcode } from "@/lib/postcode";

import { Btn, Field } from "../atoms";

export type PostcodeLookupSelection = {
  city: string;
  county: string;
  postcode: string;
};

type PostcodesIoResponse = {
  result?: {
    admin_county?: string | null;
    admin_district?: string | null;
    postcode?: string;
  } | null;
};

const unavailableMessage = "Postcode lookup is unavailable. Enter the town yourself.";

// postcodes.io is free, needs no key, and allows browser calls. It knows a
// postcode's town and county, not the street addresses within it.
async function lookupPostcodeArea(postcode: string): Promise<PostcodeLookupSelection | { error: string }> {
  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`, {
    signal: AbortSignal.timeout(6000),
  });

  if (response.status === 404) return { error: "We couldn't find that postcode." };
  if (!response.ok) return { error: unavailableMessage };

  const payload = (await response.json()) as PostcodesIoResponse;

  return {
    city: payload.result?.admin_district?.trim() ?? "",
    county: payload.result?.admin_county?.trim() ?? "",
    postcode: payload.result?.postcode ?? formatUkPostcode(postcode),
  };
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
  const [pending, setPending] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [notice, setNotice] = useState("");
  // State updates land after a render, so a ref is what stops a second lookup
  // starting before the first one has set `pending`.
  const inFlight = useRef(false);

  async function lookup() {
    if (inFlight.current) return;

    setLookupError("");
    setNotice("");

    if (!isValidUkPostcode(value)) {
      setLookupError("Enter a valid UK postcode, for example M5 4WT.");
      return;
    }

    inFlight.current = true;
    setPending(true);
    try {
      const result = await lookupPostcodeArea(value);

      if ("error" in result) {
        setLookupError(result.error);
        return;
      }

      onChange(result.postcode);
      onSelect(result);
      setNotice(result.city ? `Town filled in: ${result.city}.` : "Postcode found. Enter the town yourself.");
    } catch {
      setLookupError(unavailableMessage);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const shownError = error || lookupError;

  return (
    <div className="min-w-0">
      <Field label={label} htmlFor={id} error={shownError} hint={notice || hint} required={required}>
        <div className="flex gap-2">
          <input
            aria-invalid={Boolean(shownError)}
            autoComplete="postal-code"
            className={cn("input min-w-0 flex-1", shownError ? "border-danger bg-danger-tint" : "")}
            id={id}
            maxLength={10}
            onBlur={() => {
              if (isValidUkPostcode(value)) onChange(formatUkPostcode(value));
            }}
            onChange={(event) => {
              onChange(event.target.value.toUpperCase());
              setLookupError("");
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
            Find town
          </Btn>
        </div>
      </Field>
    </div>
  );
}
